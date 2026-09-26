/**
 * The folder the web app saves ROM and save files into (Chrome and Edge). The player
 * picks it once; the browser keeps the folder handle in IndexedDB. Browsers without
 * folder access (Firefox, Safari) download files to their Downloads folder as before.
 *
 * Chrome only opens the folder picker or re-grants access right after a click, so call
 * prepareSaveFolder() at the start of a click handler, before any long cartridge read.
 */
import { ref } from 'vue';

import { isTauriRuntime } from '@/platform/runtime';

interface PermissionMode { mode: 'readwrite' }
interface SaveFolderHandle extends FileSystemDirectoryHandle {
  queryPermission(options: PermissionMode): Promise<PermissionState>;
  requestPermission(options: PermissionMode): Promise<PermissionState>;
}
type DirectoryPicker = (options: { id?: string; mode?: 'readwrite'; startIn?: string }) => Promise<SaveFolderHandle>;

const DB_NAME = 'jkl-burner';
const STORE = 'handles';
const KEY = 'save-folder';

/** Name of the chosen folder, for the UI; null until one is picked. */
export const saveFolderName = ref<string | null>(null);

let folder: SaveFolderHandle | null | undefined;

export function supportsSaveFolder(): boolean {
  return !isTauriRuntime() && typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => { resolve(request.result); };
    request.onerror = () => { reject(request.error ?? new Error('IndexedDB unavailable')); };
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => { resolve(request.result); };
      request.onerror = () => { reject(request.error ?? new Error('IndexedDB request failed')); };
    });
  } finally {
    db.close();
  }
}

async function loadFolder(): Promise<SaveFolderHandle | null> {
  if (folder !== undefined) return folder;
  try {
    folder = (await withStore<SaveFolderHandle | undefined>('readonly', store => store.get(KEY) as IDBRequest<SaveFolderHandle | undefined>)) ?? null;
  } catch {
    folder = null;
  }
  saveFolderName.value = folder?.name ?? null;
  return folder;
}

/** Loads the remembered folder's name for the UI. */
export async function initSaveFolder(): Promise<void> {
  if (supportsSaveFolder()) await loadFolder();
}

/** Opens the folder picker (needs a click). Returns false when the player cancelled. */
export async function chooseSaveFolder(): Promise<boolean> {
  if (!supportsSaveFolder()) return false;
  try {
    const picker = (window as unknown as { showDirectoryPicker: DirectoryPicker }).showDirectoryPicker;
    const picked = await picker({ id: 'jkl-burner-saves', mode: 'readwrite', startIn: 'downloads' });
    folder = picked;
    saveFolderName.value = picked.name;
    await withStore('readwrite', store => store.put(picked, KEY)).catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

/**
 * Call at the start of a click that will save a file: asks for the folder the first
 * time, or for access again after the browser restarted. If the player cancels, the
 * file is downloaded the usual way instead.
 */
export async function prepareSaveFolder(): Promise<void> {
  if (!supportsSaveFolder()) return;
  const current = await loadFolder();
  if (!current) {
    await chooseSaveFolder();
    return;
  }
  try {
    const options: PermissionMode = { mode: 'readwrite' };
    if (await current.queryPermission(options) !== 'granted') await current.requestPermission(options);
  } catch {
    // Access stays as it is; saving falls back to a download.
  }
}

async function freeName(dir: SaveFolderHandle, filename: string): Promise<string> {
  const dot = filename.lastIndexOf('.');
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = dot > 0 ? filename.slice(dot) : '';
  for (let n = 0; n < 1000; n++) {
    const candidate = n === 0 ? filename : `${stem} (${n})${ext}`;
    try {
      await dir.getFileHandle(candidate);
    } catch {
      return candidate;
    }
  }
  return filename;
}

/**
 * Writes the file into the chosen folder without replacing an existing file.
 * Returns "Folder/name", or null when there is no folder to write to.
 */
export async function writeToSaveFolder(data: Uint8Array, filename: string): Promise<string | null> {
  if (!supportsSaveFolder()) return null;
  const dir = await loadFolder();
  if (!dir) return null;
  try {
    if (await dir.queryPermission({ mode: 'readwrite' }) !== 'granted') return null;
    const name = await freeName(dir, filename);
    const handle = await dir.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(data as BlobPart);
    await writable.close();
    return `${dir.name}/${name}`;
  } catch {
    return null;
  }
}
