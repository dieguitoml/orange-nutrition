/**
 * Minimal Google Gemini REST client (generateContent) for browser use.
 *
 * - The API key is the USER'S OWN free key (Google AI Studio), stored on-device and sent only to
 *   generativelanguage.googleapis.com in the `x-goog-api-key` header. Never bundle a key in the app.
 * - The endpoint supports CORS for browser origins (e.g. https://<user>.github.io).
 * - Free-tier requests may be used by Google to improve its products; the app shows AI_PRIVACY_NOTICE
 *   and requires consent before any request.
 * - Responses are requested as JSON constrained by a response schema, then validated with Zod by callers.
 */

export type GeminiErrorCode =
  | 'NO_KEY'
  | 'INVALID_KEY'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMITED'
  | 'MODEL_NOT_FOUND'
  | 'BLOCKED'
  | 'OFFLINE'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'HTTP'
  | 'INVALID_RESPONSE';

export class GeminiError extends Error {
  constructor(
    readonly code: GeminiErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

/** OpenAPI-subset schema accepted by Gemini `responseSchema`. */
export interface GeminiSchema {
  type: 'OBJECT' | 'ARRAY' | 'STRING' | 'NUMBER' | 'INTEGER' | 'BOOLEAN';
  properties?: Record<string, GeminiSchema>;
  required?: string[];
  items?: GeminiSchema;
  enum?: string[];
  description?: string;
  nullable?: boolean;
}

export type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };

export interface GenerateJsonOptions {
  system: string;
  parts: GeminiPart[];
  schema: GeminiSchema;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface GeminiClientOptions {
  apiKey: string;
  model: string;
  /** Tried in order when the configured model is not found (free model names change over time). */
  fallbackModels?: string[];
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';
export const GEMINI_FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];

interface GeminiErrorBody {
  error?: { code?: number; message?: string; status?: string; details?: { reason?: string }[] };
}

export class GeminiClient {
  private readonly opts: Required<Omit<GeminiClientOptions, 'fetchImpl'>> & { fetchImpl: typeof fetch };

  constructor(opts: GeminiClientOptions) {
    if (!opts.apiKey) throw new GeminiError('NO_KEY', 'No Gemini API key configured');
    this.opts = {
      apiKey: opts.apiKey,
      model: opts.model || DEFAULT_GEMINI_MODEL,
      fallbackModels: opts.fallbackModels ?? GEMINI_FALLBACK_MODELS,
      baseUrl: (opts.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, ''),
      timeoutMs: opts.timeoutMs ?? 30_000,
      fetchImpl: opts.fetchImpl ?? ((...a) => globalThis.fetch(...a)),
    };
  }

  /** Model that actually answered the last successful request. */
  lastModel: string | null = null;

  /** Calls generateContent and returns the parsed JSON object (unvalidated: callers validate). */
  async generateJson(options: GenerateJsonOptions): Promise<unknown> {
    const models = [this.opts.model, ...this.opts.fallbackModels.filter((m) => m !== this.opts.model)];
    let lastErr: GeminiError | null = null;
    for (const model of models) {
      try {
        const out = await this.callModel(model, options);
        this.lastModel = model;
        return out;
      } catch (e) {
        if (e instanceof GeminiError && e.code === 'MODEL_NOT_FOUND') {
          lastErr = e;
          continue;
        }
        throw e;
      }
    }
    throw lastErr ?? new GeminiError('MODEL_NOT_FOUND', 'No available Gemini model');
  }

  private async callModel(model: string, o: GenerateJsonOptions): Promise<unknown> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new GeminiError('OFFLINE', 'Device is offline');
    const body = {
      systemInstruction: { parts: [{ text: o.system }] },
      contents: [{ role: 'user', parts: o.parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: o.schema,
        temperature: o.temperature ?? 0.2,
        maxOutputTokens: o.maxOutputTokens ?? 4096,
      },
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs);
    let res: Response;
    try {
      res = await this.opts.fetchImpl(`${this.opts.baseUrl}/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.opts.apiKey },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      if (controller.signal.aborted) throw new GeminiError('TIMEOUT', 'The AI service did not respond in time');
      throw new GeminiError('NETWORK', `Network error: ${(e as Error)?.message ?? e}`);
    }
    clearTimeout(timer);

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new GeminiError(res.ok ? 'INVALID_RESPONSE' : 'HTTP', `AI service returned a non-JSON response (${res.status})`, res.status);
    }

    if (!res.ok) throw mapError(res.status, json as GeminiErrorBody);

    const data = json as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
    };
    if (data.promptFeedback?.blockReason) throw new GeminiError('BLOCKED', `Request blocked by the AI service (${data.promptFeedback.blockReason})`);
    const cand = data.candidates?.[0];
    if (!cand) throw new GeminiError('INVALID_RESPONSE', 'AI service returned no answer');
    if (cand.finishReason === 'SAFETY' || cand.finishReason === 'PROHIBITED_CONTENT') throw new GeminiError('BLOCKED', 'Answer blocked by the AI service');
    const text = cand.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text.trim()) throw new GeminiError('INVALID_RESPONSE', `AI service returned an empty answer${cand.finishReason ? ` (${cand.finishReason})` : ''}`);
    try {
      return JSON.parse(stripFences(text));
    } catch {
      throw new GeminiError('INVALID_RESPONSE', 'AI answer was not valid JSON');
    }
  }
}

function stripFences(text: string): string {
  const t = text.trim();
  const m = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(t);
  return m ? m[1]! : t;
}

function mapError(status: number, body: GeminiErrorBody): GeminiError {
  const msg = body.error?.message ?? `HTTP ${status}`;
  const reason = body.error?.details?.map((d) => d.reason).find(Boolean);
  const st = body.error?.status;
  if (reason === 'API_KEY_INVALID' || (status === 400 && /api key/i.test(msg))) return new GeminiError('INVALID_KEY', 'The Gemini API key is not valid', status);
  if (status === 429 || st === 'RESOURCE_EXHAUSTED') return new GeminiError('RATE_LIMITED', 'Free AI quota reached; try again later', status);
  if (status === 404 || st === 'NOT_FOUND') return new GeminiError('MODEL_NOT_FOUND', msg, status);
  if (status === 403 || st === 'PERMISSION_DENIED') return new GeminiError('PERMISSION_DENIED', msg, status);
  return new GeminiError('HTTP', msg, status);
}

/** Base64-encodes binary data (chunked; works in browsers and Node). */
export function bytesToBase64(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}
