import type { CFIInfo } from '@/utils/parsers/cfi-parser';

/** Bytes read at each candidate size to decide whether the ROM ends there. */
export const ROM_END_PROBE_SIZE = 64;

export const GBA_MAX_ROM_SIZE = 0x2000000;

/** Candidate GBA ROM sizes, smallest first. */
export const GBA_ROM_SIZE_CANDIDATES = [0x100000, 0x200000, 0x400000, 0x800000, 0x1000000] as const;

/**
 * Past the end of a GBA ROM chip the cartridge either mirrors the start of the
 * ROM or leaves the bus floating, so each 16-bit word reads back the low bits
 * of its own address ("open bus"). Either means the ROM ends at `address`.
 */
export function isRomEnd(probe: Uint8Array, head: Uint8Array, address: number): boolean {
  if (probe.length < 2) return false;

  let mirrored = true;
  for (let i = 0; i < probe.length; i += 1) {
    if (probe[i] !== head[i]) {
      mirrored = false;
      break;
    }
  }
  if (mirrored) return true;

  for (let i = 0; i + 1 < probe.length; i += 2) {
    const expected = ((address + i) >>> 1) & 0xffff;
    if ((probe[i] | (probe[i + 1] << 8)) !== expected) return false;
  }
  return true;
}

/**
 * Stand-in chip info for cartridges that do not answer the flash (CFI) query,
 * such as original cartridges. Only valid for reading: no erase or program data.
 */
export function createReadOnlyCartInfo(): CFIInfo {
  return {
    flashId: new Uint8Array(0),
    magic: '',
    dataSwap: null,
    cfiDetected: false,
    isSwapD0D1: false,
    isIntel: false,
    vddMin: 0,
    vddMax: 0,
    singleWrite: false,
    bufferWrite: false,
    sectorErase: false,
    chipErase: false,
    tbBootSector: false,
    tbBootSectorRaw: 0,
    deviceSize: GBA_MAX_ROM_SIZE,
    eraseSectorRegions: 0,
    eraseSectorBlocks: [],
    reverseSectorRegion: false,
    info: 'Read-only cartridge (no flash chip detected)',
  };
}
