export type GbaSaveKind = 'SRAM' | 'FLASH512' | 'FLASH1M' | 'EEPROM' | 'NONE';

export interface GbaSaveType {
  kind: GbaSaveKind;
  /** Save size in bytes as seen by the emulator; 0 when unknown/unsupported. */
  size: number;
}

// Order matters for identical offsets only; the earliest match in the ROM wins,
// mirroring how the emulator picks the save type.
const SAVE_SIGNATURES: readonly { tag: string; type: GbaSaveType }[] = [
  { tag: 'EEPROM_V', type: { kind: 'EEPROM', size: 0 } },
  { tag: 'SRAM_F_V', type: { kind: 'SRAM', size: 0x8000 } },
  { tag: 'SRAM_V', type: { kind: 'SRAM', size: 0x8000 } },
  { tag: 'FLASH1M_V', type: { kind: 'FLASH1M', size: 0x20000 } },
  { tag: 'FLASH512_V', type: { kind: 'FLASH512', size: 0x10000 } },
  { tag: 'FLASH_V', type: { kind: 'FLASH512', size: 0x10000 } },
];

function indexOfAscii(data: Uint8Array, tag: string, from: number): number {
  const first = tag.charCodeAt(0);
  const last = data.length - tag.length;
  outer: for (let i = from; i <= last; i += 1) {
    if (data[i] !== first) continue;
    for (let j = 1; j < tag.length; j += 1) {
      if (data[i + j] !== tag.charCodeAt(j)) continue outer;
    }
    return i;
  }
  return -1;
}

/**
 * Detect the save hardware a GBA game expects by scanning for the library
 * signature strings Nintendo's SDK embeds in the ROM.
 */
export function detectGbaSaveType(rom: Uint8Array): GbaSaveType {
  let best: { offset: number; type: GbaSaveType } | null = null;
  for (const { tag, type } of SAVE_SIGNATURES) {
    const offset = indexOfAscii(rom, tag, 0xC0);
    if (offset >= 0 && (!best || offset < best.offset)) {
      best = { offset, type };
    }
  }
  return best?.type ?? { kind: 'NONE', size: 0 };
}

/**
 * Drop trailing erased (0xFF) space from a ROM read off a flash chip, keeping
 * a power-of-two length so the game still sees a plausible cartridge size.
 */
export function trimErasedRomTail(rom: Uint8Array, minSize = 0x100000): Uint8Array {
  let end = rom.length;
  while (end > 0 && rom[end - 1] === 0xFF) end -= 1;
  let size = minSize;
  while (size < end) size *= 2;
  return size >= rom.length ? rom : rom.subarray(0, size);
}
