/**
 * Three-tier image cache for AI-generated drink images (OpenRouter / FLUX).
 *
 * Tier 1 — in-memory Map: zero-latency, same JS session only.
 * Tier 2 — IndexedDB:     persists across tabs, reloads, and browser restarts.
 * Tier 3 — in-flight Map: deduplicates concurrent requests for the same drink
 *          so parallel Promise.all calls share one network round-trip.
 *
 * Cache key: lowercased drink name + sorted ingredient names (measures ignored).
 */

const DB_NAME = "bar-help-images";
const DB_VERSION = 1;
const STORE_NAME = "images";

const memCache = new Map();

/** Promises for in-flight network requests, keyed by cache key. */
const inflightMap = new Map();

/** Lazily-opened DB handle. */
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
  return dbPromise;
}

function idbGet(key) {
  return openDB().then(
    (db) =>
      new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, "readonly");
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result ?? null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  ).catch(() => null);
}

function idbPut(key, value) {
  return openDB().then(
    (db) =>
      new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          store.put(value, key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      }),
  ).catch(() => {});
}

/**
 * Build a stable, compact cache key for a drink.
 * Keyed on name + sorted ingredient names (ignoring measures which can vary).
 */
export function drinkImageKey(drink) {
  const name = (drink.name ?? "").trim().toLowerCase();
  const ings = (drink.ingredients ?? [])
    .map((i) => (i.name ?? "").trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join(",");
  return `${name}|${ings}`;
}

/** Large base64 payloads — keep out of `localStorage` (saved drinks JSON). */
export function isDataImageUrl(s) {
  return typeof s === "string" && s.startsWith("data:image/");
}

/**
 * Return cached image URL if present (memory → IndexedDB), or null.
 * Async because IndexedDB reads are async.
 */
export async function getCachedImage(drink) {
  const key = drinkImageKey(drink);

  if (memCache.has(key)) return memCache.get(key);

  const stored = await idbGet(key);
  if (stored) {
    memCache.set(key, stored);
    return stored;
  }
  return null;
}

/** Store a URL in both memory and IndexedDB. */
export async function setCachedImage(drink, url) {
  if (!url) return;
  const key = drinkImageKey(drink);
  memCache.set(key, url);
  await idbPut(key, url);
}

/**
 * Deduplicated image fetch. If an in-flight request for the same cache key
 * already exists, the returned promise shares that result instead of starting
 * a second network call. `fetchFn` should be a () => Promise<string|null>.
 */
export function dedupeImageFetch(drink, fetchFn) {
  const key = drinkImageKey(drink);

  if (inflightMap.has(key)) return inflightMap.get(key);

  const work = fetchFn().finally(() => {
    inflightMap.delete(key);
  });

  inflightMap.set(key, work);
  return work;
}
