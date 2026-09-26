#!/usr/bin/env python3
"""Packs the JKL GBA Burner firmware for flashing.

    python3 tools/jkl_images.py BOOTLOADER.bin APP.bin VERSION OUT_DIR

Writes to OUT_DIR:
  jkl_gba_burner_full_vVERSION.hex   bootloader + firmware + info page, for a one-time
                                     ST-Link flash (the addresses are in the file)
  jkl_gba_burner_update_vVERSION.bin firmware only, for updating over USB
  jkl_gba_burner_update.json         version, size and CRC-32 of that update

The layout matches common/jkl_flash_layout.h.
"""
import json
import os
import struct
import sys
import zlib

FLASH_BASE = 0x08000000
BOOT_SIZE = 0x5000
APP_BASE = FLASH_BASE + BOOT_SIZE
META_ADDR = 0x0800FC00
META_MAGIC = 0x414C4B4A  # "JKLA"


def version_number(text):
    major, minor, patch = (int(p) for p in text.split("."))
    return (major << 16) | (minor << 8) | patch


def hex_records(address, data):
    out = []
    upper = None
    for offset in range(0, len(data), 16):
        addr = address + offset
        if addr >> 16 != upper:
            upper = addr >> 16
            out.append(record(0, 4, struct.pack(">H", upper)))
        out.append(record(addr & 0xFFFF, 0, data[offset:offset + 16]))
    return out


def record(addr, kind, payload):
    body = bytes([len(payload), addr >> 8, addr & 0xFF, kind]) + payload
    checksum = (-sum(body)) & 0xFF
    return ":" + (body + bytes([checksum])).hex().upper()


def main():
    boot_path, app_path, version, out_dir = sys.argv[1:5]
    boot = open(boot_path, "rb").read()
    app = open(app_path, "rb").read()
    if len(boot) > BOOT_SIZE:
        sys.exit(f"bootloader is {len(boot)} bytes, the limit is {BOOT_SIZE}")
    if len(app) > META_ADDR - APP_BASE:
        sys.exit(f"firmware is {len(app)} bytes, the limit is {META_ADDR - APP_BASE}")
    crc = zlib.crc32(app) & 0xFFFFFFFF
    meta = struct.pack("<IIII", META_MAGIC, len(app), crc, version_number(version))

    os.makedirs(out_dir, exist_ok=True)
    lines = hex_records(FLASH_BASE, boot) + hex_records(APP_BASE, app) + hex_records(META_ADDR, meta)
    lines.append(":00000001FF")
    full = os.path.join(out_dir, f"jkl_gba_burner_full_v{version}.hex")
    with open(full, "w") as f:
        f.write("\n".join(lines) + "\n")
    update = os.path.join(out_dir, f"jkl_gba_burner_update_v{version}.bin")
    with open(update, "wb") as f:
        f.write(app)
    with open(os.path.join(out_dir, "jkl_gba_burner_update.json"), "w") as f:
        json.dump({"version": version, "file": os.path.basename(update), "size": len(app), "crc32": f"{crc:08x}"}, f, indent=2)
        f.write("\n")
    print(f"bootloader {len(boot)} B, firmware {len(app)} B, crc32 {crc:08x}")
    print(full)
    print(update)


if __name__ == "__main__":
    main()
