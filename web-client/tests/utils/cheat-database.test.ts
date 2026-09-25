import { describe, expect, it } from 'vitest';

import { formatCheatCode, parseChtFile, queryFromTitle, searchCheatFiles } from '@/utils/cheat-database';

describe('formatCheatCode', () => {
  it('pairs Code Breaker parts', () => {
    expect(formatCheatCode('0000C6A1+000A+100015D8+0007')).toBe('0000C6A1 000A\n100015D8 0007');
  });

  it('pairs GameShark / Action Replay parts', () => {
    expect(formatCheatCode('D8BAE4D9+4864DCE5')).toBe('D8BAE4D9 4864DCE5');
  });

  it('puts Game Boy codes on their own lines', () => {
    expect(formatCheatCode('01FF34D2+01FF35D2+01FF36D2')).toBe('01FF34D2\n01FF35D2\n01FF36D2');
    expect(formatCheatCode('00A-17B-C49')).toBe('00A-17B-C49');
  });
});

describe('parseChtFile', () => {
  it('reads descriptions and codes in order', () => {
    const text = [
      'cheats = 2',
      '',
      'cheat0_desc = "Master Code"',
      'cheat0_code = "0000C6A1+000A+100015D8+0007"',
      'cheat0_enable = false',
      '',
      'cheat1_desc = "Infinite Lives"',
      'cheat1_code = "320008B4+0009"',
    ].join('\n');
    expect(parseChtFile(text)).toEqual([
      { name: 'Master Code', code: '0000C6A1 000A\n100015D8 0007' },
      { name: 'Infinite Lives', code: '320008B4 0009' },
    ]);
  });
});

describe('searchCheatFiles', () => {
  const files = [
    'Pokemon - Emerald Version (USA, Europe) (Code Breaker)',
    'Pokemon - Ruby Version (USA, Europe) (Code Breaker)',
    'Golden Sun (USA, Europe) (Code Breaker)',
    'Golden Sun - The Lost Age (USA, Europe) (Code Breaker)',
  ];

  it('matches cartridge header titles by word prefixes', () => {
    expect(searchCheatFiles(files, queryFromTitle('POKEMON EMER'))).toEqual([files[0]]);
    expect(searchCheatFiles(files, queryFromTitle('GOLDEN_SUN_A'))[0]).toBe(files[2]);
    expect(searchCheatFiles(files, 'golden sun')[0]).toBe(files[2]);
  });
});
