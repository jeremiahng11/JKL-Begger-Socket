/**
 * Cheat database from libretro-database (https://github.com/libretro/libretro-database/tree/master/cht).
 * The app ships only the list of file names (public/cheats/libretro-index.json, built by
 * scripts/build-cheat-index.py); a game's cheats are downloaded when it is picked.
 */

export type CheatSystem = 'gba' | 'gb' | 'gbc';

export interface CheatIndex {
  source: string;
  systems: Record<CheatSystem, { folder: string; files: string[] }>;
}

export interface DatabaseCheat {
  name: string;
  code: string;
}

const RAW_BASE = 'https://raw.githubusercontent.com/libretro/libretro-database/master/cht';

let indexPromise: Promise<CheatIndex> | null = null;

export function loadCheatIndex(): Promise<CheatIndex> {
  indexPromise ??= fetch(new URL('cheats/libretro-index.json', document.baseURI).href)
    .then(async (response) => {
      if (!response.ok) throw new Error(`Cheat index: HTTP ${response.status}`);
      return await response.json() as CheatIndex;
    });
  indexPromise.catch(() => {
    indexPromise = null;
  });
  return indexPromise;
}

function words(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
}

/** Search words from a cartridge header title such as "POKEMON EMER" or "GOLDEN_SUN_A". */
export function queryFromTitle(title: string): string {
  // Headers pad or suffix titles with stray letters ("GOLDEN_SUN_A"); keep real words.
  return words(title).filter(word => word.length > 1 || /\d/.test(word)).join(' ');
}

/** Files whose name contains every search word as the start of a word, best matches first. */
export function searchCheatFiles(files: string[], query: string, limit = 25): string[] {
  const needles = words(query);
  if (!needles.length) return [];
  const scored: { file: string; score: number }[] = [];
  for (const file of files) {
    const hay = words(file);
    let score = 0;
    for (const needle of needles) {
      const hit = hay.findIndex(word => word.startsWith(needle));
      if (hit < 0) {
        score = -1;
        break;
      }
      score += hay[hit] === needle ? 3 : 1;
    }
    if (score >= 0) scored.push({ file, score: score - hay.length * 0.01 });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map(entry => entry.file);
}

export async function fetchCheatFile(index: CheatIndex, system: CheatSystem, file: string): Promise<DatabaseCheat[]> {
  const folder = index.systems[system].folder;
  const url = `${RAW_BASE}/${encodeURIComponent(folder)}/${encodeURIComponent(`${file}.cht`)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return parseChtFile(await response.text());
}

/** Parses a RetroArch .cht file (cheatN_desc / cheatN_code). */
export function parseChtFile(text: string): DatabaseCheat[] {
  const fields = new Map<string, string>();
  for (const match of text.matchAll(/^\s*cheat(\d+)_(desc|code)\s*=\s*"([^"]*)"/gm)) {
    fields.set(`${match[1]}_${match[2]}`, match[3]);
  }
  const cheats: DatabaseCheat[] = [];
  for (let i = 0; fields.has(`${i}_code`) || fields.has(`${i}_desc`); i += 1) {
    const code = formatCheatCode(fields.get(`${i}_code`) ?? '');
    const name = (fields.get(`${i}_desc`) ?? '').trim();
    if (code) cheats.push({ name: name.length ? name : `Cheat ${i + 1}`, code });
  }
  return cheats;
}

const HEX = /^[0-9A-F]+$/;

/**
 * libretro joins code parts with "+". GBA codes come in pairs (8+4 digits for Code
 * Breaker, 8+8 for GameShark/Action Replay), so pairs go on one line; other codes
 * (Game Boy GameShark, Game Genie) get a line each.
 */
export function formatCheatCode(code: string): string {
  const parts = code.split('+').map(part => part.trim().toUpperCase()).filter(Boolean);
  const paired = parts.length % 2 === 0 && parts.every((part, i) =>
    HEX.test(part) && (i % 2 === 0 ? part.length === 8 : part.length === 4 || part.length === 8));
  if (!paired) return parts.join('\n');
  const lines: string[] = [];
  for (let i = 0; i < parts.length; i += 2) lines.push(`${parts[i]} ${parts[i + 1]}`);
  return lines.join('\n');
}
