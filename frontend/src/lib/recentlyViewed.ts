const STORAGE_KEY = 'careplus_recently_viewed';
const MAX_IDS = 10;

/** Returns the list of recently viewed product IDs (newest first). */
export function getRecentProductIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string').slice(0, MAX_IDS);
  } catch {
    return [];
  }
}

/** Appends a product ID to recently viewed (moves to front if already present), max 10. */
export function addRecentProductId(productId: string): void {
  if (!productId) return;
  const ids = getRecentProductIds().filter((id) => id !== productId);
  ids.unshift(productId);
  const toStore = ids.slice(0, MAX_IDS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // ignore quota or other errors
  }
}
