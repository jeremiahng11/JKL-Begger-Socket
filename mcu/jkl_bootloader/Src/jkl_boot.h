#ifndef JKL_BOOT_H
#define JKL_BOOT_H

#include <stdint.h>

/* Called from the USB CDC receive callback with bytes from the host. */
void boot_rx(const uint8_t *buf, uint32_t len);

#endif
