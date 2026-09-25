#!/usr/bin/env python3
"""Builds the cheat index (file names only) from libretro-database.

Cheats are fetched on demand from
https://github.com/libretro/libretro-database/tree/master/cht
Usage: python3 scripts/build-cheat-index.py <output.json>
"""
import json
import sys
import urllib.request

API = 'https://api.github.com/repos/libretro/libretro-database'
SYSTEMS = {
    'gba': 'Nintendo - Game Boy Advance',
    'gbc': 'Nintendo - Game Boy Color',
    'gb': 'Nintendo - Game Boy',
}


def get(url):
    with urllib.request.urlopen(url) as response:
        return json.load(response)


def main(out_path):
    folders = {entry['name']: entry['sha'] for entry in get(f'{API}/contents/cht')}
    index = {'source': 'https://github.com/libretro/libretro-database/tree/master/cht', 'systems': {}}
    for key, folder in SYSTEMS.items():
        tree = get(f'{API}/git/trees/{folders[folder]}')
        names = sorted(item['path'][:-4] for item in tree['tree'] if item['path'].endswith('.cht'))
        index['systems'][key] = {'folder': folder, 'files': names}
        print(f'{key}: {len(names)} cheat files')
    with open(out_path, 'w', encoding='utf-8') as out:
        json.dump(index, out, ensure_ascii=False, separators=(',', ':'))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'public/cheats/libretro-index.json')
