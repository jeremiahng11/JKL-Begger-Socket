export interface GameCheat {
  name: string;
  code: string;
  enabled: boolean;
}

/**
 * mGBA cheat file: "# name" starts a cheat, "!disabled" turns it off and the
 * code lines follow. mGBA detects GameShark, Action Replay and CodeBreaker codes.
 */
export function toMgbaCheatsFile(cheats: GameCheat[]): string {
  return cheats
    .filter(cheat => cheat.code.trim().length > 0)
    .map((cheat) => {
      const name = cheat.name.replace(/[\r\n]+/g, ' ').trim() || 'Cheat';
      const lines = cheat.code
        .split(/\r?\n/)
        .map(line => line.trim().toUpperCase())
        .filter(line => line.length > 0);
      return [`# ${name}`, ...(cheat.enabled ? [] : ['!disabled']), ...lines].join('\n');
    })
    .join('\n\n') + '\n';
}

const STORAGE_PREFIX = 'jkl-cheats:';

export function loadCheats(gameKey: string): GameCheat[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + gameKey);
    const parsed = raw ? JSON.parse(raw) as unknown : [];
    return Array.isArray(parsed) ? parsed as GameCheat[] : [];
  } catch {
    return [];
  }
}

export function storeCheats(gameKey: string, cheats: GameCheat[]): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + gameKey, JSON.stringify(cheats));
  } catch {
    // Storage unavailable (private mode); cheats last for this session only.
  }
}
