import type { AiSettings } from '../../core/types/domain';
import { aiSettingsSchema } from '../../core/validation/schemas';
import { DataError } from '../../core/utils/errors';
import { nowIso } from '../../core/utils/dates';
import { metaRepository } from '../../data/repositories';
import { DEFAULT_GEMINI_MODEL, GeminiClient, GeminiError } from '../../integrations/gemini/client';

/** Shown to the user before AI can be enabled. Consent is stored with a timestamp. */
export const AI_PRIVACY_NOTICE = [
  'AI features send data to Google Gemini using your own free API key:',
  '• Photo recognition sends the meal photo you take.',
  '• The AI assistant and suggestions send your chat messages (and the last few turns of the conversation), today’s logged foods and nutrient totals, your 7-day nutrient averages, targets, allergies, diets, disliked foods, and the names/nutrition of candidate foods from the app’s food list.',
  'Older meal history, backups and other personal data are never sent.',
  'On Google’s free tier, requests may be reviewed and used by Google to improve its products. Do not use AI features if that is not acceptable.',
  'AI output is never used for nutrient values: the app always calculates nutrition from its own food database, and you confirm every item before it is logged.',
].join('\n');

const KEY = 'aiSettings';

export function defaultAiSettings(): AiSettings {
  return { provider: 'gemini', apiKey: null, model: DEFAULT_GEMINI_MODEL, photoRecognitionEnabled: false, aiSuggestionsEnabled: false, consentAcceptedAt: null };
}

/** Full settings INCLUDING the API key. Never render the key; use getAiSettingsPublic for UI. */
export async function getAiSettings(): Promise<AiSettings> {
  const stored = await metaRepository.get<AiSettings>(KEY);
  return stored ? { ...defaultAiSettings(), ...stored } : defaultAiSettings();
}

export interface AiSettingsPublic extends Omit<AiSettings, 'apiKey'> {
  hasApiKey: boolean;
  /** e.g. "…x9Qk" for display. */
  apiKeyHint: string | null;
  photoRecognitionAvailable: boolean;
  aiSuggestionsAvailable: boolean;
}

export async function getAiSettingsPublic(): Promise<AiSettingsPublic> {
  const s = await getAiSettings();
  const { apiKey, ...rest } = s;
  const ready = !!apiKey && !!s.consentAcceptedAt;
  return { ...rest, hasApiKey: !!apiKey, apiKeyHint: apiKey ? `…${apiKey.slice(-4)}` : null, photoRecognitionAvailable: ready && s.photoRecognitionEnabled, aiSuggestionsAvailable: ready && s.aiSuggestionsEnabled };
}

async function save(next: AiSettings): Promise<AiSettings> {
  const parsed = aiSettingsSchema.safeParse(next);
  if (!parsed.success) throw new DataError('VALIDATION', 'Invalid AI settings', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  const ready = !!parsed.data.apiKey && !!parsed.data.consentAcceptedAt;
  // Features can only be on when a key exists and consent was given.
  const value: AiSettings = { ...parsed.data, photoRecognitionEnabled: ready && parsed.data.photoRecognitionEnabled, aiSuggestionsEnabled: ready && parsed.data.aiSuggestionsEnabled };
  await metaRepository.set(KEY, value);
  return value;
}

export async function setAiApiKey(apiKey: string | null): Promise<AiSettingsPublic> {
  await save({ ...(await getAiSettings()), apiKey: apiKey?.trim() || null });
  return getAiSettingsPublic();
}

export async function acceptAiPrivacyNotice(): Promise<AiSettingsPublic> {
  await save({ ...(await getAiSettings()), consentAcceptedAt: nowIso() });
  return getAiSettingsPublic();
}

/** Withdraws consent and turns all AI features off (the key is kept unless `forgetKey`). */
export async function revokeAiConsent(forgetKey = false): Promise<AiSettingsPublic> {
  const s = await getAiSettings();
  await save({ ...s, consentAcceptedAt: null, photoRecognitionEnabled: false, aiSuggestionsEnabled: false, ...(forgetKey ? { apiKey: null } : {}) });
  return getAiSettingsPublic();
}

export async function updateAiSettings(patch: Partial<Pick<AiSettings, 'model' | 'photoRecognitionEnabled' | 'aiSuggestionsEnabled'>>): Promise<AiSettingsPublic> {
  const s = await getAiSettings();
  const wantsOn = patch.photoRecognitionEnabled || patch.aiSuggestionsEnabled;
  if (wantsOn && !s.apiKey) throw new DataError('VALIDATION', 'Add your Gemini API key first');
  if (wantsOn && !s.consentAcceptedAt) throw new DataError('VALIDATION', 'Accept the AI privacy notice first');
  await save({ ...s, ...patch });
  return getAiSettingsPublic();
}

// ----- client factory -----

let fetchOverride: typeof fetch | undefined;
/** Tests / custom transport. */
export function configureAiFetch(fetchImpl: typeof fetch | undefined): void {
  fetchOverride = fetchImpl;
}

export type AiFeature = 'photo' | 'suggestions';

/** Returns a client if the feature is enabled, otherwise throws DataError('UNAVAILABLE'). */
export async function getAiClient(feature: AiFeature): Promise<GeminiClient> {
  const s = await getAiSettings();
  if (!s.apiKey) throw new DataError('UNAVAILABLE', 'No AI API key configured');
  if (!s.consentAcceptedAt) throw new DataError('UNAVAILABLE', 'AI privacy notice not accepted');
  if (feature === 'photo' && !s.photoRecognitionEnabled) throw new DataError('UNAVAILABLE', 'AI photo recognition is turned off');
  if (feature === 'suggestions' && !s.aiSuggestionsEnabled) throw new DataError('UNAVAILABLE', 'AI suggestions are turned off');
  return new GeminiClient({ apiKey: s.apiKey, model: s.model, ...(fetchOverride ? { fetchImpl: fetchOverride } : {}) });
}

/** Sends a tiny request to verify the key/model. Requires key + consent (feature switches not needed). */
export async function testAiConnection(): Promise<{ ok: true; model: string } | { ok: false; code: string; message: string }> {
  const s = await getAiSettings();
  if (!s.apiKey) return { ok: false, code: 'NO_KEY', message: 'No API key configured' };
  if (!s.consentAcceptedAt) return { ok: false, code: 'NO_CONSENT', message: 'Accept the AI privacy notice first' };
  const client = new GeminiClient({ apiKey: s.apiKey, model: s.model, timeoutMs: 15_000, ...(fetchOverride ? { fetchImpl: fetchOverride } : {}) });
  try {
    await client.generateJson({ system: 'Reply with {"ok": true}.', parts: [{ text: 'ping' }], schema: { type: 'OBJECT', properties: { ok: { type: 'BOOLEAN' } }, required: ['ok'] }, maxOutputTokens: 20 });
    return { ok: true, model: client.lastModel ?? s.model };
  } catch (e) {
    if (e instanceof GeminiError) return { ok: false, code: e.code, message: e.message };
    throw e;
  }
}
