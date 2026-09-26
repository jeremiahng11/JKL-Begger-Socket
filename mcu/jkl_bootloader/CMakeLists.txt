##########################################################################################################################
# JKL GBA Burner bootloader (STM32F103C8T6)
# Lives in the first 20 KB of flash and updates the burner firmware over USB.
# Reuses the HAL, USB library and startup code of ../chis_flash_burner.
##########################################################################################################################

cmake_minimum_required(VERSION 3.16)

set(CMAKE_SYSTEM_NAME Generic)
set(CMAKE_SYSTEM_PROCESSOR arm)
set(TOOLCHAIN_PREFIX arm-none-eabi-)
set(CMAKE_C_COMPILER ${TOOLCHAIN_PREFIX}gcc)
set(CMAKE_ASM_COMPILER ${TOOLCHAIN_PREFIX}gcc)
set(CMAKE_OBJCOPY ${TOOLCHAIN_PREFIX}objcopy)
set(CMAKE_SIZE ${TOOLCHAIN_PREFIX}size)
set(CMAKE_TRY_COMPILE_TARGET_TYPE STATIC_LIBRARY)

project(jkl_bootloader C ASM)
set(CMAKE_C_STANDARD 11)

set(APP ${CMAKE_CURRENT_SOURCE_DIR}/../chis_flash_burner)

set(SOURCES
    Src/main.c
    Src/usbd_cdc_if.c
    Src/usbd_desc.c
    ${APP}/Core/Src/stm32f1xx_hal_msp.c
    ${APP}/Core/Src/stm32f1xx_it.c
    ${APP}/Core/Src/syscalls.c
    ${APP}/Core/Src/sysmem.c
    ${APP}/Core/Src/system_stm32f1xx.c
    ${APP}/Core/Startup/startup_stm32f103c8tx.s
    ${APP}/Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_cortex.c
    ${APP}/Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_flash_ex.c
    ${APP}/Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_flash.c
    ${APP}/Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_gpio_ex.c
    ${APP}/Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_gpio.c
    ${APP}/Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_pwr.c
    ${APP}/Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_rcc_ex.c
    ${APP}/Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_rcc.c
    ${APP}/Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal.c
    ${APP}/Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_pcd_ex.c
    ${APP}/Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_pcd.c
    ${APP}/Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_ll_usb.c
    ${APP}/Middlewares/ST/STM32_USB_Device_Library/Class/CDC/Src/usbd_cdc.c
    ${APP}/Middlewares/ST/STM32_USB_Device_Library/Core/Src/usbd_core.c
    ${APP}/Middlewares/ST/STM32_USB_Device_Library/Core/Src/usbd_ctlreq.c
    ${APP}/Middlewares/ST/STM32_USB_Device_Library/Core/Src/usbd_ioreq.c
    ${APP}/USB_DEVICE/App/usb_device.c
    ${APP}/USB_DEVICE/Target/usbd_conf.c
)

set(CMAKE_ASM_FLAGS "-mcpu=cortex-m3 -mthumb -x assembler-with-cpp")

add_executable(jkl_bootloader ${SOURCES})
set_target_properties(jkl_bootloader PROPERTIES SUFFIX ".elf")
target_include_directories(jkl_bootloader PRIVATE
    Src
    ${CMAKE_CURRENT_SOURCE_DIR}/../common
    ${APP}/Core/Inc
    ${APP}/Drivers/CMSIS/Device/ST/STM32F1xx/Include
    ${APP}/Drivers/CMSIS/Include
    ${APP}/Drivers/STM32F1xx_HAL_Driver/Inc
    ${APP}/Drivers/STM32F1xx_HAL_Driver/Inc/Legacy
    ${APP}/Middlewares/ST/STM32_USB_Device_Library/Class/CDC/Inc
    ${APP}/Middlewares/ST/STM32_USB_Device_Library/Core/Inc
    ${APP}/USB_DEVICE/App
    ${APP}/USB_DEVICE/Target
)
target_compile_definitions(jkl_bootloader PRIVATE USE_HAL_DRIVER STM32F103xB)
target_compile_options(jkl_bootloader PRIVATE
    -mcpu=cortex-m3 -mthumb -Os -Wall -fdata-sections -ffunction-sections -fno-common -ffreestanding)
target_link_options(jkl_bootloader PRIVATE
    -mcpu=cortex-m3 -mthumb -specs=nano.specs -Wl,--gc-sections -lc
    -T${CMAKE_CURRENT_SOURCE_DIR}/jkl_bootloader.ld
    -Wl,-Map=${CMAKE_BINARY_DIR}/jkl_bootloader.map)

add_custom_command(TARGET jkl_bootloader POST_BUILD
    COMMAND ${CMAKE_OBJCOPY} -O binary -S $<TARGET_FILE:jkl_bootloader> ${CMAKE_BINARY_DIR}/jkl_bootloader.bin
    COMMAND ${CMAKE_SIZE} $<TARGET_FILE:jkl_bootloader>
    COMMENT "Building jkl_bootloader.bin")
