import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeOffProduct, OpenFoodFactsClient, offProductSchema } from '../integrations/openFoodFacts';
import { configureOpenFoodFacts, createFoodForBarcode, getFoodByBarcode, isValidGtin, lookupBarcode, normalizeBarcode } from '../services/barcode';
import { cacheRepository } from '../data/repositories';
import { searchFoods } from '../services/food';
import { freshDb, k } from './helpers';
import { OFF_FULL, OFF_NOT_FOUND, OFF_PARTIAL, OFF_SERVING_ONLY } from './fixtures/off';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('Open Food Facts normalization', () => {
  it('maps a complete product into canonical units', () => {
    const food = normalizeOffProduct('3017620422003', offProductSchema.parse(OFF_FULL.product), '2026-11-07T00:00:00.000Z');
    expect(food.id).toBe('off_3017620422003');
    expect(food.brand).toBe('BrandCo');
    expect(food.source).toMatchObject({ type: 'open_food_facts', license: expect.stringMatching(/ODbL/), attribution: expect.stringMatching(/Open Food Facts/) });
    const n = food.nutrientsPer100g;
    expect(n.energy).toEqual({ status: 'known', amount: 539 });
    expect(n.fiber).toEqual({ status: 'zero', amount: 0 });
    expect(n.sodium?.amount).toBeCloseTo(42.8, 9); // g → mg
    expect(n.sodium?.status).toBe('known'); // declared sodium preferred over salt
    expect(n.calcium?.amount).toBeCloseTo(108, 9);
    expect(n.iron?.amount).toBeCloseTo(4.2, 9); // numeric string accepted
    expect(n.vitaminE?.amount).toBeCloseTo(6.2, 9);
    expect(n.vitaminC).toBeUndefined(); // missing stays missing
    expect(food.allergens).toEqual(expect.arrayContaining(['milk', 'tree_nuts', 'soy']));
    expect(food.dietaryFlags).toContain('dairy');
    expect(food.allergenInfo).toBe('declared');
    expect(food.servings[0]).toMatchObject({ grams: 15, label: '15 g', isDefault: true });
  });

  it('handles incomplete data: kJ-only energy, salt-derived sodium, unknown allergens', () => {
    const food = normalizeOffProduct('5000000000001', offProductSchema.parse(OFF_PARTIAL.product));
    expect(food.name).toBe('Sparkling water lemon');
    expect(food.nutrientsPer100g.energy?.amount).toBeCloseTo(8 / 4.184, 9);
    expect(food.nutrientsPer100g.sodium).toMatchObject({ status: 'estimated' });
    expect(food.nutrientsPer100g.sodium?.amount).toBeCloseTo(8, 9);
    expect(food.nutrientsPer100g.carbohydrate).toEqual({ status: 'zero', amount: 0 });
    expect(food.nutrientsPer100g.sugar?.amount).toBeCloseTo(0.4, 9); // from per-serving with serving_quantity "250"
    expect(food.nutrientsPer100g.protein).toBeUndefined();
    expect(food.allergenInfo).toBe('unknown');
    expect(food.completeness.hasCoreMacros).toBe(false);
  });

  it('derives per-100 g from per-serving data', () => {
    const food = normalizeOffProduct('1234567890128', offProductSchema.parse(OFF_SERVING_ONLY.product));
    expect(food.nutrientsPer100g.energy?.amount).toBeCloseTo(350, 9);
    expect(food.nutrientsPer100g.protein?.amount).toBeCloseTo(33.333333, 5);
  });

  it('validates barcodes', () => {
    expect(normalizeBarcode(' 3017-6204 22003 ')).toBe('3017620422003');
    expect(normalizeBarcode('abc')).toBeNull();
    expect(isValidGtin('3017620422003')).toBe(true);
    expect(isValidGtin('3017620422004')).toBe(false);
    expect(isValidGtin('036000291452')).toBe(true); // UPC-A
  });
});

describe('Open Food Facts client', () => {
  it('dedupes concurrent requests for the same barcode', async () => {
    const fetchImpl = vi.fn(async () => json(OFF_FULL));
    const c = new OpenFoodFactsClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const [a, b] = await Promise.all([c.fetchProduct('3017620422003'), c.fetchProduct('3017620422003')]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(a.status).toBe('found');
    expect(b).toBe(a);
    const url = String((fetchImpl.mock.calls[0] as unknown as [string])[0]);
    expect(url).toContain('/api/v2/product/3017620422003.json');
    expect(url).toContain('app_name=nutrition_app');
  });

  it('treats 404 / status 0 as not found', async () => {
    const c = new OpenFoodFactsClient({ fetchImpl: (async () => json(OFF_NOT_FOUND, 404)) as unknown as typeof fetch });
    expect(await c.fetchProduct('0000000000000')).toEqual({ status: 'not_found' });
  });

  it('retries transient failures then succeeds', async () => {
    let n = 0;
    const fetchImpl = vi.fn(async () => (++n < 2 ? json({}, 503) : json(OFF_FULL)));
    const c = new OpenFoodFactsClient({ fetchImpl: fetchImpl as unknown as typeof fetch, sleep: async () => {} });
    expect((await c.fetchProduct('3017620422003')).status).toBe('found');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('times out', async () => {
    const fetchImpl = (_: unknown, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    const c = new OpenFoodFactsClient({ fetchImpl: fetchImpl as unknown as typeof fetch, timeoutMs: 10, maxRetries: 0 });
    await expect(c.fetchProduct('3017620422003')).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('enforces a client-side rate limit and maps 429', async () => {
    const c = new OpenFoodFactsClient({ fetchImpl: (async () => json(OFF_FULL)) as unknown as typeof fetch, maxRequestsPerMinute: 1 });
    await c.fetchProduct('3017620422003');
    await expect(c.fetchProduct('5000000000001')).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    const c2 = new OpenFoodFactsClient({ fetchImpl: (async () => json({}, 429)) as unknown as typeof fetch });
    await expect(c2.fetchProduct('3017620422003')).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('rejects malformed responses', async () => {
    const c = new OpenFoodFactsClient({ fetchImpl: (async () => new Response('<html>', { status: 200 })) as unknown as typeof fetch });
    await expect(c.fetchProduct('3017620422003')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});

describe('barcode service (cache + fallback)', () => {
  beforeEach(async () => {
    await freshDb();
  });

  it('fetches once, caches, and serves offline afterwards', async () => {
    const fetchImpl = vi.fn(async () => json(OFF_FULL));
    configureOpenFoodFacts(new OpenFoodFactsClient({ fetchImpl: fetchImpl as unknown as typeof fetch }));
    const f1 = await getFoodByBarcode('3017620422003');
    expect(f1?.name).toBe('Hazelnut spread');
    const f2 = await getFoodByBarcode('3017620422003');
    expect(f2?.id).toBe(f1?.id);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    // product is now searchable locally
    expect((await searchFoods('hazelnut spread'))[0]?.food.id).toBe('off_3017620422003');
  });

  it('caches negative results', async () => {
    const fetchImpl = vi.fn(async () => json(OFF_NOT_FOUND, 404));
    configureOpenFoodFacts(new OpenFoodFactsClient({ fetchImpl: fetchImpl as unknown as typeof fetch }));
    expect(await getFoodByBarcode('0000000000000')).toBeNull();
    expect(await getFoodByBarcode('0000000000000')).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('falls back to a stale cache entry on network failure, otherwise reports an error', async () => {
    configureOpenFoodFacts(new OpenFoodFactsClient({ fetchImpl: (async () => json(OFF_FULL)) as unknown as typeof fetch }));
    await getFoodByBarcode('3017620422003');
    const cached = await cacheRepository.get('3017620422003');
    await cacheRepository.put({ ...cached!, expiresAt: '2000-01-01T00:00:00.000Z' });
    configureOpenFoodFacts(new OpenFoodFactsClient({ fetchImpl: (async () => { throw new TypeError('Load failed'); }) as unknown as typeof fetch, maxRetries: 0 }));
    const r = await lookupBarcode('3017620422003');
    expect(r).toMatchObject({ status: 'found', origin: 'stale_cache' });
    const r2 = await lookupBarcode('5000000000001');
    expect(r2).toMatchObject({ status: 'error', code: 'NETWORK' });
    await expect(getFoodByBarcode('5000000000001')).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    await expect(getFoodByBarcode('12ab')).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('manual entry fallback wins on subsequent scans', async () => {
    const fetchImpl = vi.fn(async () => json(OFF_NOT_FOUND, 404));
    configureOpenFoodFacts(new OpenFoodFactsClient({ fetchImpl: fetchImpl as unknown as typeof fetch }));
    expect(await getFoodByBarcode('4006381333931')).toBeNull();
    const manual = await createFoodForBarcode('4006381333931', { name: 'Local bakery rye', nutrientsPer100g: { energy: k(250) } });
    expect((await getFoodByBarcode('4006381333931'))?.id).toBe(manual.id);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
