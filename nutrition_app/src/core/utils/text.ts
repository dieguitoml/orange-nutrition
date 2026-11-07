/** Lowercases, strips diacritics and punctuation, collapses whitespace. */
export function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const STOP = new Set(['and', 'or', 'with', 'without', 'the', 'of', 'a', 'an', 'in', 'raw']);

/** Search tokens (unique, normalized). 'raw' etc. are dropped as low-signal words. */
export function tokenize(input: string, keepStopWords = false): string[] {
  const words = normalizeText(input).split(' ').filter(Boolean);
  const out = new Set<string>();
  for (const w of words) {
    if (!keepStopWords && STOP.has(w)) continue;
    out.add(w);
    // crude singularisation so "eggs" matches "egg"
    if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) out.add(w.slice(0, -1));
  }
  return [...out];
}
