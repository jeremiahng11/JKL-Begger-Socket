# JKL GBA Burner firmware (STM32)

The burner firmware (`chis_flash_burner/`) now runs behind a small USB bootloader
(`jkl_bootloader/`), so it can be updated over the burner's own USB cable.

| Flash address | What                                   |
|---------------|----------------------------------------|
| `0x08000000`  | JKL bootloader (20 KB)                 |
| `0x08005000`  | Burner firmware (up to 43 KB)          |
| `0x0800FC00`  | Info page: size, CRC-32, version       |

The bootloader starts the firmware only when its CRC-32 matches the info page. If an
update is interrupted it stays in update mode (slowly blinking light) and shows up as
**JKL GBA Burner Updater** (USB `0483:0722`), ready to try again.

## Build

Needs the [Arm GNU toolchain](https://developer.arm.com/downloads/-/arm-gnu-toolchain-downloads)
(`arm-none-eabi-gcc`) on `PATH`, CMake and Ninja.

```sh
./build-jkl.sh
```

Results in `dist/`:

- `jkl_gba_burner_full_vX.Y.Z.hex` – bootloader + firmware + info page
- `jkl_gba_burner_update_vX.Y.Z.bin` and `jkl_gba_burner_update.json` – firmware only, for USB updates

The version comes from `JKL_FW_VERSION` in `chis_flash_burner/CMakeLists.txt`. To ship an
update on the website, copy the two update files into `web-client/public/firmware/`.

## First install (once, with an ST-Link)

Burners with the original firmware can't update themselves. Flash the full image once:

- STM32CubeProgrammer: connect via ST-LINK, open `jkl_gba_burner_full_vX.Y.Z.hex`, Download
  (the .hex holds the addresses; no start address needed).

## Updates (USB)

On the website: **Tools → Firmware update**. With the burner connected it shows the installed
version; **Update** restarts the burner into update mode, then pick **JKL GBA Burner Updater**
in Chrome's list. A `.bin` file can also be chosen by hand.

## New commands in the burner firmware

- `0xb0` – returns 64 bytes: `JKL GBA Burner|<version>|stm32|boot1|<features>` (zero padded)
- `0xb1` – acknowledges (`0xaa`) and restarts into the bootloader's update mode
