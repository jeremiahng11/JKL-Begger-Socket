import { describe, expect, it } from 'vitest';

import { detectGbaSaveType, trimErasedRomTail } from '@/utils/gba-save-type';

function romWith(tags: [number, string][], size = 0x1000): Uint8Array {
  const rom = new Uint8Array(size);
  for (const [offset, tag] of tags) {
    rom.set(Array.from(tag, c => c.charCodeAt(0)), offset);
  }
  return rom;
}

describe('detectGbaSaveType', () => {
  it('detects SRAM saves', () => {
    expect(detectGbaSaveType(romWith([[0x400, 'SRAM_V113']]))).toEqual({ kind: 'SRAM', size: 0x8000 });
  });

  it('detects 128KB flash saves', () => {
    expect(detectGbaSaveType(romWith([[0x400, 'FLASH1M_V103']]))).toEqual({ kind: 'FLASH1M', size: 0x20000 });
  });

  it('detects 64KB flash saves from both signatures', () => {
    expect(detectGbaSaveType(romWith([[0x400, 'FLASH_V126']])).kind).toBe('FLASH512');
    expect(detectGbaSaveType(romWith([[0x400, 'FLASH512_V131']])).kind).toBe('FLASH512');
  });

  it('reports EEPROM saves as unsized', () => {
    expect(detectGbaSaveType(romWith([[0x400, 'EEPROM_V124']]))).toEqual({ kind: 'EEPROM', size: 0 });
  });

  it('uses the earliest signature in the ROM', () => {
    const rom = romWith([[0x800, 'SRAM_V113'], [0x400, 'FLASH1M_V103']]);
    expect(detectGbaSaveType(rom).kind).toBe('FLASH1M');
  });

  it('returns NONE when the game has no save library', () => {
    expect(detectGbaSaveType(romWith([]))).toEqual({ kind: 'NONE', size: 0 });
  });
});

describe('trimErasedRomTail', () => {
  it('trims erased space to the next power of two', () => {
    const rom = new Uint8Array(0x800000).fill(0xFF);
    rom.fill(0x00, 0, 0x180000);
    expect(trimErasedRomTail(rom).length).toBe(0x200000);
  });

  it('keeps a full ROM untouched', () => {
    const rom = new Uint8Array(0x400000);
    expect(trimErasedRomTail(rom)).toBe(rom);
  });

  it('never trims below the minimum size', () => {
    const rom = new Uint8Array(0x800000).fill(0xFF);
    rom[0] = 0;
    expect(trimErasedRomTail(rom).length).toBe(0x100000);
  });
});
