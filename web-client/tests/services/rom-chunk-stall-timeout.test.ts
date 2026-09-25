import { describe, expect, it } from 'vitest';

import { CartridgeAdapter } from '@/services/cartridge-adapter';

describe('CartridgeAdapter.romChunkStallTimeoutMs', () => {
  it('gives up on a stalled 4KB chunk well before the full packet timeout', () => {
    expect(CartridgeAdapter.romChunkStallTimeoutMs(0x1000)).toBe(505);
  });

  it('scales with the chunk size for slower firmware', () => {
    expect(CartridgeAdapter.romChunkStallTimeoutMs(0x200)).toBe(326);
  });

  it('never exceeds the configured packet timeout', () => {
    expect(CartridgeAdapter.romChunkStallTimeoutMs(0x100000)).toBe(3000);
  });
});
