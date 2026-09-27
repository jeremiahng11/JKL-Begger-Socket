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

describe('firmware release notes', () => {
  const manifest = {
    version: '1.0.2', file: 'x.bin', size: 1, crc32: '0',
    changelog: [
      { version: '1.0.2', released: '2026-09-27', notes: ['b'] },
      { version: '1.0.1', released: '2026-09-27', notes: ['a'] },
    ],
  };

  it('lists every release after the installed one', async () => {
    const { releasesSince } = await import('@/services/jkl-firmware');
    expect(releasesSince(manifest, '1.0.0').map(r => r.version)).toEqual(['1.0.2', '1.0.1']);
    expect(releasesSince(manifest, '1.0.1').map(r => r.version)).toEqual(['1.0.2']);
  });

  it('falls back to the latest release when up to date or unknown', async () => {
    const { releasesSince } = await import('@/services/jkl-firmware');
    expect(releasesSince(manifest, '1.0.2').map(r => r.version)).toEqual(['1.0.2']);
    expect(releasesSince(manifest, null).map(r => r.version)).toEqual(['1.0.2']);
  });
});
