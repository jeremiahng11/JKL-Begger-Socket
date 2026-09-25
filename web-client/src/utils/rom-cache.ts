const DB_NAME = 'jkl-burner-rom-cache';
const STORE = 'roms';
const MAX_ENTRIES = 3;

/** Bytes read from the start of the cartridge to recognise a cached ROM. */
export const ROM_FINGERPRINT_SIZE = 0x10000;

interface CachedRom {
  key: string;
  rom: Uint8Array;
  title: string;
  savedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB open failed'));
    };
  });
}

function run<T>(mode: IDBTransactionMode, body: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(db => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = body(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(request.result); };
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('IndexedDB transaction failed')); };
  }));
}

export async function romFingerprint(head: Uint8Array, baseAddress: number): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', head.slice(0, ROM_FINGERPRINT_SIZE));
  const hex = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  return `${baseAddress.toString(16)}:${hex}`;
}

export async function getCachedRom(key: string): Promise<Uint8Array | null> {
  try {
    const entry = await run<CachedRom | undefined>('readonly', store => store.get(key) as IDBRequest<CachedRom | undefined>);
    return entry?.rom ?? null;
  } catch (error) {
    console.warn('ROM cache read failed:', error);
    return null;
  }
}

export async function putCachedRom(key: string, rom: Uint8Array, title: string): Promise<void> {
  try {
    const entries = await run<CachedRom[]>('readonly', store => store.getAll() as IDBRequest<CachedRom[]>);
    const stale = entries
      .filter(entry => entry.key !== key)
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(MAX_ENTRIES - 1);
    for (const entry of stale) {
      await run('readwrite', store => store.delete(entry.key));
    }
    await run('readwrite', store => store.put({ key, rom, title, savedAt: Date.now() } satisfies CachedRom));
  } catch (error) {
    console.warn('ROM cache write failed:', error);
  }
}
