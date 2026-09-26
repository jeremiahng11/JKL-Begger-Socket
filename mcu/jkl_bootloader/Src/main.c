/*
 * JKL GBA Burner bootloader.
 *
 * On reset it starts the burner firmware ("app") when the app is intact and no
 * update was asked for. Otherwise it shows up over USB as "JKL GBA Burner Updater"
 * (0483:0722) and accepts a new app. See mcu/common/jkl_flash_layout.h.
 *
 * Protocol (both directions): 'J' cmd len_lo len_hi payload[len] crc_lo crc_hi
 * (CRC-16/MODBUS over everything before it). Replies carry a status byte in place
 * of cmd: 0 ok, 1 bad request, 2 flash error, 3 verify/CRC mismatch.
 *   0x01 INFO                        -> ASCII description
 *   0x02 ERASE  size:u32             -> erases the info page, then the app area
 *   0x03 WRITE  offset:u32 data[]    -> programs data (even length) at app+offset
 *   0x04 FINISH size:u32 crc:u32 ver:u32 -> checks the CRC-32, writes the info page
 *   0x05 RUN                         -> resets into the new app
 */
#include <stdbool.h>
#include <string.h>

#include "main.h"
#include "usb_device.h"
#include "usbd_cdc_if.h"

#include "jkl_boot.h"
#include "jkl_flash_layout.h"

#define BOOT_VERSION_STR "1"
#define FRAME_MAX (4 + 4 + 1024 + 2)

enum { ST_OK = 0, ST_BAD = 1, ST_FLASH = 2, ST_VERIFY = 3 };

extern USBD_HandleTypeDef hUsbDeviceFS;

static uint8_t rx_buf[2 * FRAME_MAX];
static volatile uint32_t rx_len;
static uint8_t tx_buf[4 + 128 + 2];

static void SystemClock_Config(void);

void Error_Handler(void)
{
    __disable_irq();
    while (1) {
    }
}

static uint16_t crc16_modbus(const uint8_t *buf, uint32_t len)
{
    uint16_t crc = 0xFFFF;
    for (uint32_t i = 0; i < len; i++) {
        crc ^= buf[i];
        for (int b = 0; b < 8; b++) crc = (crc & 1) ? (crc >> 1) ^ 0xA001 : crc >> 1;
    }
    return crc;
}

static uint32_t crc32_ieee(const uint8_t *p, uint32_t len)
{
    uint32_t crc = 0xFFFFFFFFu;
    for (uint32_t i = 0; i < len; i++) {
        crc ^= p[i];
        for (int b = 0; b < 8; b++) crc = (crc >> 1) ^ (0xEDB88320u & (0u - (crc & 1u)));
    }
    return ~crc;
}

static bool app_valid(void)
{
    const jkl_app_meta_t *meta = (const jkl_app_meta_t *)JKL_META_ADDR;
    if (meta->magic != JKL_META_MAGIC || meta->size < 8 || meta->size > JKL_APP_MAX) return false;
    uint32_t sp = *(const uint32_t *)JKL_APP_BASE;
    uint32_t entry = *(const uint32_t *)(JKL_APP_BASE + 4);
    if (sp < 0x20000000u || sp > 0x20005000u) return false;
    if (entry < JKL_APP_BASE || entry >= JKL_APP_BASE + meta->size) return false;
    return crc32_ieee((const uint8_t *)JKL_APP_BASE, meta->size) == meta->crc32;
}

/* The app sets backup register DR1 before resetting to ask for updater mode. */
static bool update_requested(void)
{
    __HAL_RCC_PWR_CLK_ENABLE();
    __HAL_RCC_BKP_CLK_ENABLE();
    HAL_PWR_EnableBkUpAccess();
    bool requested = (BKP->DR1 & 0xFFFFu) == JKL_BOOT_REQUEST;
    BKP->DR1 = 0;
    return requested;
}

static void jump_to_app(void)
{
    uint32_t sp = *(const uint32_t *)JKL_APP_BASE;
    uint32_t entry = *(const uint32_t *)(JKL_APP_BASE + 4);
    HAL_RCC_DeInit();
    HAL_DeInit();
    SysTick->CTRL = 0;
    SysTick->LOAD = 0;
    SysTick->VAL = 0;
    __disable_irq();
    for (int i = 0; i < 8; i++) {
        NVIC->ICER[i] = 0xFFFFFFFFu;
        NVIC->ICPR[i] = 0xFFFFFFFFu;
    }
    SCB->VTOR = JKL_APP_BASE;
    __set_MSP(sp);
    __enable_irq();
    ((void (*)(void))entry)();
    while (1) {
    }
}

/* Boards with a fixed pull-up on D+ need a nudge so the host sees the new device. */
static void usb_reenumerate(void)
{
    __HAL_RCC_GPIOA_CLK_ENABLE();
    GPIO_InitTypeDef gpio = {0};
    gpio.Pin = GPIO_PIN_12;
    gpio.Mode = GPIO_MODE_OUTPUT_PP;
    gpio.Speed = GPIO_SPEED_FREQ_LOW;
    HAL_GPIO_WritePin(GPIOA, GPIO_PIN_12, GPIO_PIN_RESET);
    HAL_GPIO_Init(GPIOA, &gpio);
    HAL_Delay(20);
    HAL_GPIO_DeInit(GPIOA, GPIO_PIN_12);
}

static void led_init(void)
{
    __HAL_RCC_GPIOC_CLK_ENABLE();
    GPIO_InitTypeDef gpio = {0};
    gpio.Pin = led_Pin;
    gpio.Mode = GPIO_MODE_OUTPUT_PP;
    gpio.Speed = GPIO_SPEED_FREQ_LOW;
    HAL_GPIO_WritePin(led_GPIO_Port, led_Pin, GPIO_PIN_SET);
    HAL_GPIO_Init(led_GPIO_Port, &gpio);
}

void boot_rx(const uint8_t *buf, uint32_t len)
{
    uint32_t have = rx_len;
    if (have + len > sizeof(rx_buf)) return; /* host sends one frame at a time; drop overflow */
    memcpy(rx_buf + have, buf, len);
    rx_len = have + len;
}

static void reply(uint8_t status, const uint8_t *payload, uint16_t len)
{
    const USBD_CDC_HandleTypeDef *hcdc = (USBD_CDC_HandleTypeDef *)hUsbDeviceFS.pClassData;
    tx_buf[0] = 'J';
    tx_buf[1] = status;
    tx_buf[2] = len & 0xFF;
    tx_buf[3] = len >> 8;
    if (len) memcpy(tx_buf + 4, payload, len);
    uint16_t crc = crc16_modbus(tx_buf, 4 + len);
    tx_buf[4 + len] = crc & 0xFF;
    tx_buf[5 + len] = crc >> 8;
    uint32_t start = HAL_GetTick();
    while (hcdc->TxState != 0 && HAL_GetTick() - start < 500) {
    }
    CDC_Transmit_FS(tx_buf, 6 + len);
}

static int put_str(char *out, int n, const char *text)
{
    while (*text) out[n++] = *text++;
    return n;
}

static int put_hex(char *out, int n, uint32_t value, int digits)
{
    for (int i = digits - 1; i >= 0; i--) out[n++] = "0123456789abcdef"[(value >> (i * 4)) & 0xF];
    return n;
}

static uint32_t rd32(const uint8_t *p)
{
    return p[0] | (p[1] << 8) | (p[2] << 16) | ((uint32_t)p[3] << 24);
}

static bool erase_pages(uint32_t addr, uint32_t count)
{
    FLASH_EraseInitTypeDef erase = {0};
    uint32_t error = 0;
    erase.TypeErase = FLASH_TYPEERASE_PAGES;
    erase.PageAddress = addr;
    erase.NbPages = count;
    HAL_FLASH_Unlock();
    bool ok = HAL_FLASHEx_Erase(&erase, &error) == HAL_OK;
    HAL_FLASH_Lock();
    return ok;
}

static bool program(uint32_t addr, const uint8_t *data, uint32_t len)
{
    bool ok = true;
    HAL_FLASH_Unlock();
    for (uint32_t i = 0; i < len && ok; i += 2) {
        uint16_t half = data[i] | (i + 1 < len ? data[i + 1] << 8 : 0xFF00);
        ok = HAL_FLASH_Program(FLASH_TYPEPROGRAM_HALFWORD, addr + i, half) == HAL_OK;
    }
    HAL_FLASH_Lock();
    return ok && memcmp((const void *)addr, data, len) == 0;
}

static void handle(uint8_t cmd, const uint8_t *p, uint16_t len)
{
    switch (cmd) {
        case 0x01: {
            char info[96];
            const jkl_app_meta_t *meta = (const jkl_app_meta_t *)JKL_META_ADDR;
            bool valid = app_valid();
            int n = 0;
            n = put_str(info, n, "JKLBOOT|" BOOT_VERSION_STR "|app=");
            n = put_hex(info, n, JKL_APP_BASE, 8);
            n = put_str(info, n, "|max=");
            n = put_hex(info, n, JKL_APP_MAX, 4);
            n = put_str(info, n, "|page=0400|installed=");
            n = put_str(info, n, valid ? "yes|version=" : "no|version=");
            n = put_hex(info, n, valid ? meta->version : 0, 6);
            reply(ST_OK, (const uint8_t *)info, n);
            break;
        }
        case 0x02: {
            if (len != 4) { reply(ST_BAD, NULL, 0); break; }
            uint32_t size = rd32(p);
            if (size == 0 || size > JKL_APP_MAX) { reply(ST_BAD, NULL, 0); break; }
            /* Info page first: from here on the old app no longer counts as installed. */
            bool ok = erase_pages(JKL_META_ADDR, 1) &&
                      erase_pages(JKL_APP_BASE, (size + JKL_PAGE_SIZE - 1) / JKL_PAGE_SIZE);
            reply(ok ? ST_OK : ST_FLASH, NULL, 0);
            break;
        }
        case 0x03: {
            if (len < 6 || ((len - 4) & 1)) { reply(ST_BAD, NULL, 0); break; }
            uint32_t offset = rd32(p);
            uint32_t n = len - 4;
            if ((offset & 1) || offset + n > JKL_APP_MAX) { reply(ST_BAD, NULL, 0); break; }
            reply(program(JKL_APP_BASE + offset, p + 4, n) ? ST_OK : ST_FLASH, NULL, 0);
            break;
        }
        case 0x04: {
            if (len != 12) { reply(ST_BAD, NULL, 0); break; }
            jkl_app_meta_t meta = {JKL_META_MAGIC, rd32(p), rd32(p + 4), rd32(p + 8)};
            if (meta.size == 0 || meta.size > JKL_APP_MAX ||
                crc32_ieee((const uint8_t *)JKL_APP_BASE, meta.size) != meta.crc32) {
                reply(ST_VERIFY, NULL, 0);
                break;
            }
            bool ok = erase_pages(JKL_META_ADDR, 1) && program(JKL_META_ADDR, (const uint8_t *)&meta, sizeof(meta));
            reply(ok ? ST_OK : ST_FLASH, NULL, 0);
            break;
        }
        case 0x05:
            reply(ST_OK, NULL, 0);
            HAL_Delay(100);
            NVIC_SystemReset();
            break;
        default:
            reply(ST_BAD, NULL, 0);
            break;
    }
}

static void poll_frames(void)
{
    uint32_t have = rx_len;
    if (have == 0) return;
    if (rx_buf[0] != 'J') { /* out of step: drop a byte */
        __disable_irq();
        memmove(rx_buf, rx_buf + 1, rx_len - 1);
        rx_len--;
        __enable_irq();
        return;
    }
    if (have < 4) return;
    uint16_t len = rx_buf[2] | (rx_buf[3] << 8);
    uint32_t total = 4u + len + 2u;
    if (total > FRAME_MAX) { /* nonsense length: start over */
        __disable_irq();
        rx_len = 0;
        __enable_irq();
        reply(ST_BAD, NULL, 0);
        return;
    }
    if (have < total) return;
    uint16_t crc = rx_buf[4 + len] | (rx_buf[5 + len] << 8);
    static uint8_t frame[FRAME_MAX];
    memcpy(frame, rx_buf, total);
    __disable_irq();
    memmove(rx_buf, rx_buf + total, rx_len - total);
    rx_len -= total;
    __enable_irq();
    if (crc != crc16_modbus(frame, 4 + len)) {
        reply(ST_BAD, NULL, 0);
        return;
    }
    handle(frame[1], frame + 4, len);
}

int main(void)
{
    HAL_Init();
    SystemClock_Config();
    if (!update_requested() && app_valid()) jump_to_app();

    led_init();
    usb_reenumerate();
    MX_USB_DEVICE_Init();
    uint32_t blink = HAL_GetTick();
    while (1) {
        poll_frames();
        if (HAL_GetTick() - blink > 300) { /* slow blink: updater mode */
            blink = HAL_GetTick();
            HAL_GPIO_TogglePin(led_GPIO_Port, led_Pin);
        }
    }
}

static void SystemClock_Config(void)
{
    RCC_OscInitTypeDef osc = {0};
    RCC_ClkInitTypeDef clk = {0};
    RCC_PeriphCLKInitTypeDef periph = {0};

    osc.OscillatorType = RCC_OSCILLATORTYPE_HSE;
    osc.HSEState = RCC_HSE_ON;
    osc.HSEPredivValue = RCC_HSE_PREDIV_DIV1;
    osc.HSIState = RCC_HSI_ON;
    osc.PLL.PLLState = RCC_PLL_ON;
    osc.PLL.PLLSource = RCC_PLLSOURCE_HSE;
    osc.PLL.PLLMUL = RCC_PLL_MUL9;
    if (HAL_RCC_OscConfig(&osc) != HAL_OK) Error_Handler();

    clk.ClockType = RCC_CLOCKTYPE_HCLK | RCC_CLOCKTYPE_SYSCLK | RCC_CLOCKTYPE_PCLK1 | RCC_CLOCKTYPE_PCLK2;
    clk.SYSCLKSource = RCC_SYSCLKSOURCE_PLLCLK;
    clk.AHBCLKDivider = RCC_SYSCLK_DIV1;
    clk.APB1CLKDivider = RCC_HCLK_DIV2;
    clk.APB2CLKDivider = RCC_HCLK_DIV1;
    if (HAL_RCC_ClockConfig(&clk, FLASH_LATENCY_2) != HAL_OK) Error_Handler();

    periph.PeriphClockSelection = RCC_PERIPHCLK_USB;
    periph.UsbClockSelection = RCC_USBCLKSOURCE_PLL_DIV1_5;
    if (HAL_RCCEx_PeriphCLKConfig(&periph) != HAL_OK) Error_Handler();
}
