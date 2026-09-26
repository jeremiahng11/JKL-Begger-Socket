import { describe, expect, it } from 'vitest';

import { crc32, parseFirmwareInfo, updaterFrame, versionNumber } from '@/services/jkl-firmware';
import { modbusCRC16_lut } from '@/utils/crc-utils';

describe('JKL firmware updater', () => {
  it('uses the standard CRC-32 (matches the bootloader and zlib)', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('frames requests as J cmd len payload crc16', () => {
    const frame = updaterFrame(0x03, new Uint8Array([1, 2, 3]));
    expect(Array.from(frame.subarray(0, 7))).toEqual([0x4a, 0x03, 3, 0, 1, 2, 3]);
    const crc = modbusCRC16_lut(frame.subarray(0, 7));
    expect(frame[7] | (frame[8] << 8)).toBe(crc);
  });

  it('packs versions the way the bootloader stores them', () => {
    expect(versionNumber('1.1.0')).toBe(0x010100);
    expect(versionNumber('2.10.3')).toBe(0x020a03);
  });

  it('reads the firmware info reply', () => {
    const bytes = new Uint8Array(64);
    bytes.set(new TextEncoder().encode('JKL GBA Burner|1.1.0|stm32|boot1|gba,gbc,fram,sector-erase'));
    expect(parseFirmwareInfo(bytes)).toEqual({
      name: 'JKL GBA Burner',
      version: '1.1.0',
      hardware: 'stm32',
      bootloader: true,
      features: ['gba', 'gbc', 'fram', 'sector-erase'],
    });
    expect(parseFirmwareInfo(new Uint8Array(64))).toBeNull();
  });
});
