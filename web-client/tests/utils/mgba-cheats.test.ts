import { describe, expect, it } from 'vitest';

import { toMgbaCheatsFile } from '@/utils/mgba-cheats';

describe('toMgbaCheatsFile', () => {
  it('writes enabled and disabled cheats in mGBA format', () => {
    const file = toMgbaCheatsFile([
      { name: 'Max money', code: '1a2b3c4d 00000063\n  5e6f7a8b 00001234 ', enabled: true },
      { name: 'Walk through walls', code: '0A1B2C3D 0000FFFF', enabled: false },
    ]);
    expect(file).toBe(
      '# Max money\n1A2B3C4D 00000063\n5E6F7A8B 00001234\n\n'
      + '# Walk through walls\n!disabled\n0A1B2C3D 0000FFFF\n',
    );
  });

  it('skips cheats without code and keeps names on one line', () => {
    const file = toMgbaCheatsFile([
      { name: 'Empty', code: '   ', enabled: true },
      { name: 'Two\nlines', code: '12345678 9ABCDEF0', enabled: true },
    ]);
    expect(file).toBe('# Two lines\n12345678 9ABCDEF0\n');
  });
});
