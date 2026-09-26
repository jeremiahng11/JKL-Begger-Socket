/*
 * Flash layout shared by the JKL bootloader and the burner firmware (STM32F103C8, 64 KB).
 *
 *   0x08000000  bootloader (20 KB)
 *   0x08005000  burner firmware ("app", up to 43 KB)
 *   0x0800FC00  app info page: size, CRC32 and version of the installed app
 *
 * The bootloader starts the app only when its CRC32 matches the info page, so an
 * interrupted update leaves the burner in the updater instead of bricking it.
 */
#ifndef JKL_FLASH_LAYOUT_H
#define JKL_FLASH_LAYOUT_H

#include <stdint.h>

#define JKL_FLASH_BASE      0x08000000u
#define JKL_PAGE_SIZE       0x400u
#define JKL_BOOT_SIZE       0x5000u
#define JKL_APP_BASE        (JKL_FLASH_BASE + JKL_BOOT_SIZE)
#define JKL_META_ADDR       0x0800FC00u
#define JKL_APP_MAX         (JKL_META_ADDR - JKL_APP_BASE)

#define JKL_META_MAGIC      0x414C4B4Au /* "JKLA" */
/* Written to backup register DR1 by the app to ask the bootloader to stay in updater mode. */
#define JKL_BOOT_REQUEST    0x4A4Bu

typedef struct {
    uint32_t magic;
    uint32_t size;     /* bytes of app image */
    uint32_t crc32;    /* CRC-32 (IEEE) of the app image */
    uint32_t version;  /* 0x00MMmmpp */
} jkl_app_meta_t;

#endif
