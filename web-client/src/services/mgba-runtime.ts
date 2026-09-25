/**
 * mGBA (WebAssembly) emulator runtime, served from /mgba (see public/mgba/NOTICE.txt).
 *
 * The runtime is created once per page and reused: it owns a single canvas that the
 * emulator component moves into view. It needs a cross-origin isolated page because
 * it runs on threads (see nginx.conf).
 */

export interface MgbaFilePaths {
  gamePath: string;
  savePath: string;
}

interface MgbaFS {
  writeFile(path: string, data: Uint8Array): void;
  unlink(path: string): void;
  analyzePath(path: string): { exists: boolean };
}

export interface MgbaCoreCallbacks {
  saveDataUpdatedCallback?: (() => void) | null;
  coreCrashedCallback?: (() => void) | null;
}

export interface MgbaModule {
  FS: MgbaFS;
  FSInit(): Promise<void>;
  filePaths(): MgbaFilePaths;
  loadGame(romPath: string, savePathOverride?: string): boolean;
  getSave(): Uint8Array | null;
  pauseGame(): void;
  resumeGame(): void;
  resumeAudio(): void;
  quickReload(): void;
  quitGame(): void;
  buttonPress(name: string): void;
  buttonUnpress(name: string): void;
  toggleInput(enabled: boolean): void;
  addCoreCallbacks(callbacks: MgbaCoreCallbacks): void;
}

type MgbaFactory = (options: { canvas: HTMLCanvasElement }) => Promise<MgbaModule>;

let runtime: Promise<{ module: MgbaModule; canvas: HTMLCanvasElement }> | null = null;

export function isCrossOriginIsolated(): boolean {
  return typeof window !== 'undefined' && window.crossOriginIsolated;
}

export function loadMgbaRuntime(): Promise<{ module: MgbaModule; canvas: HTMLCanvasElement }> {
  runtime ??= (async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 160;
    const url = new URL('mgba/mgba.js', document.baseURI).href;
    const imported = await import(/* @vite-ignore */ url) as { default: MgbaFactory };
    const module = await imported.default({ canvas });
    await module.FSInit();
    return { module, canvas };
  })();
  runtime.catch(() => {
    runtime = null;
  });
  return runtime;
}

/** Removes a file from the emulator's virtual file system if it exists. */
export function removeFile(module: MgbaModule, path: string): void {
  try {
    if (module.FS.analyzePath(path).exists) module.FS.unlink(path);
  } catch {
    // Missing files are fine.
  }
}
