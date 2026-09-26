#!/bin/bash
# Builds the JKL bootloader and burner firmware and packs them into mcu/dist.
# Needs the Arm GNU toolchain (arm-none-eabi-gcc) on PATH, cmake and ninja.
set -e
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD="${BUILD_DIR:-$HERE/build-jkl}"
VERSION=$(sed -n 's/^set(JKL_FW_VERSION "\(.*\)")/\1/p' "$HERE/chis_flash_burner/CMakeLists.txt")

cmake -S "$HERE/jkl_bootloader" -B "$BUILD/bootloader" -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build "$BUILD/bootloader"
cmake -S "$HERE/chis_flash_burner" -B "$BUILD/firmware" -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build "$BUILD/firmware"

python3 "$HERE/tools/jkl_images.py" "$BUILD/bootloader/jkl_bootloader.bin" \
    "$BUILD/firmware/chis_flash_burner.bin" "$VERSION" "$HERE/dist"
