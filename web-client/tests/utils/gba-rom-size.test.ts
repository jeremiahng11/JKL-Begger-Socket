import { describe, expect, it } from 'vitest';

import { createReadOnlyCartInfo, isRomEnd } from '@/utils/gba-rom-size';

function openBus(address: number, length: number): Uint8Array {
  const data = new Uint8Array(length);
  for (let i = 0; i < length; i += 2) {
    const word = ((address + i) >>> 1) & 0xffff;
    data[i] = word & 0xff;
    data[i + 1] = word >> 8;
  }
  return data;
}

describe('isRomEnd', () => {
  const head = Uint8Array.from({ length: 64 }, (_, i) => (i * 37 + 11) & 0xff);

  it('detects a mirrored ROM', () => {
    expect(isRomEnd(head.slice(), head, 0x400000)).toBe(true);
  });

  it('detects open bus past the end of the chip', () => {
    expect(isRomEnd(openBus(0x800000, 64), head, 0x800000)).toBe(true);
  });

  it('keeps reading when real game data follows', () => {
    const data = Uint8Array.from({ length: 64 }, (_, i) => (i * 91 + 5) & 0xff);
    expect(isRomEnd(data, head, 0x400000)).toBe(false);
  });

  it('does not treat erased flash as the end of the ROM', () => {
    expect(isRomEnd(new Uint8Array(64).fill(0xff), head, 0x400000)).toBe(false);
  });
});

describe('createReadOnlyCartInfo', () => {
  it('describes a 32MB cartridge with no flash operations', () => {
    const info = createReadOnlyCartInfo();
    expect(info.deviceSize).toBe(0x2000000);
    expect(info.cfiDetected).toBe(false);
    expect(info.eraseSectorBlocks).toEqual([]);
  });
});
