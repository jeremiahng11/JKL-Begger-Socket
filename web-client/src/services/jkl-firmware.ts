/**
 * JKL GBA Burner firmware: version info and USB updates.
 *
 * The burner firmware (from 1.1.0) answers 0xb0 with its name and version and
 * restarts into the JKL bootloader on 0xb1. The bootloader shows up as a separate
 * USB device, "JKL GBA Burner Updater" (0483:0722), speaking the small framed
 * protocol below. See mcu/jkl_bootloader/Src/main.c.
 */
import type { Transport } from '@/platform/serial';
import { WebSerialTransport } from '@/platform/serial/transports';
import { modbusCRC16_lut } from '@/utils/crc-utils';

export const UPDATER_PORT_FILTER: SerialPortFilter = { usbVendorId: 0x0483, usbProductId: 0x0722 };
export const LATEST_FIRMWARE_MANIFEST = 'firmware/jkl_gba_burner_update.json';

const CMD_FIRMWARE_INFO = 0xb0;
const CMD_ENTER_UPDATER = 0xb1;
const INFO_SIZE = 64;
const WRITE_CHUNK = 1024;

export interface BurnerFirmwareInfo {
  name: string;
  version: string;
  hardware: string;
  bootloader: boolean;
  features: string[];
}

export interface FirmwareManifest {
  version: string;
  file: string;
  size: number;
  crc32: string;
}

/** A burner command with no arguments: [size:2][cmd][crc:2]. */
function simpleCommand(cmd: number): Uint8Array {
  return new Uint8Array([5, 0, cmd, 0, 0]);
}

/** Firmware name and version, or null for firmware without version info (anything before 1.1.0). */
export async function readFirmwareInfo(transport: Transport): Promise<BurnerFirmwareInfo | null> {
  try {
    const { data } = await transport.sendAndReceive(simpleCommand(CMD_FIRMWARE_INFO), 2 + INFO_SIZE, 1000, 800);
    if (data.byteLength < 2 + INFO_SIZE) return null;
    return parseFirmwareInfo(data.subarray(2));
  } catch {
    // Older firmware ignores the command: make sure nothing late is left behind.
    await transport.drainInput?.(100, 500);
    return null;
  }
}

export function parseFirmwareInfo(bytes: Uint8Array): BurnerFirmwareInfo | null {
  const end = bytes.indexOf(0);
  const text = new TextDecoder().decode(end >= 0 ? bytes.subarray(0, end) : bytes);
  const [name, version, hardware, boot, features] = text.split('|');
  if (!name || !version) return null;
  return {
    name,
    version,
    hardware: hardware ?? '',
    bootloader: (boot ?? '').startsWith('boot'),
    features: features ? features.split(',') : [],
  };
}

/** Asks the burner to restart into the updater. Its USB connection drops right after. */
export async function restartIntoUpdater(transport: Transport): Promise<void> {
  try {
    await transport.sendAndReceive(simpleCommand(CMD_ENTER_UPDATER), 1, 1000, 1000);
  } catch {
    // The reset can beat the acknowledgement; the updater showing up is what counts.
  }
}

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let b = 0; b < 8; b++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function versionNumber(version: string): number {
  const [major = 0, minor = 0, patch = 0] = version.split('.').map(part => parseInt(part, 10) || 0);
  return ((major & 0xff) << 16) | ((minor & 0xff) << 8) | (patch & 0xff);
}

/** 'J' cmd len_lo len_hi payload crc_lo crc_hi (CRC-16/MODBUS). */
export function updaterFrame(cmd: number, payload: Uint8Array = new Uint8Array()): Uint8Array {
  const frame = new Uint8Array(4 + payload.length + 2);
  frame[0] = 0x4a;
  frame[1] = cmd;
  frame[2] = payload.length & 0xff;
  frame[3] = payload.length >> 8;
  frame.set(payload, 4);
  const crc = modbusCRC16_lut(frame.subarray(0, 4 + payload.length));
  frame[4 + payload.length] = crc & 0xff;
  frame[5 + payload.length] = crc >> 8;
  return frame;
}

function u32(...values: number[]): Uint8Array {
  const out = new Uint8Array(values.length * 4);
  const view = new DataView(out.buffer);
  values.forEach((value, i) => { view.setUint32(i * 4, value >>> 0, true); });
  return out;
}

const STATUS_TEXT = ['ok', 'the updater rejected the request', 'writing to the burner\'s memory failed', 'the firmware check failed'];

/** A connection to the burner in updater mode. */
export class UpdaterSession {
  private constructor(private readonly port: SerialPort, private readonly transport: WebSerialTransport) {}

  static async open(port: SerialPort): Promise<UpdaterSession> {
    await port.open({ baudRate: 115200, bufferSize: 8192 });
    return new UpdaterSession(port, new WebSerialTransport(port));
  }

  async close(): Promise<void> {
    try {
      await this.transport.close?.();
    } catch {
      try { await this.port.close(); } catch {}
    }
  }

  private async request(cmd: number, payload?: Uint8Array, timeoutMs = 3000): Promise<Uint8Array> {
    const frame = updaterFrame(cmd, payload);
    const head = await this.transport.sendAndReceive(frame, 4, 2000, timeoutMs);
    const header = head.data;
    if (header.byteLength < 4 || header[0] !== 0x4a) throw new Error('The updater sent an unexpected reply');
    const length = header[2] | (header[3] << 8);
    const rest = (await this.transport.read(length + 2, timeoutMs)).data;
    const reply = new Uint8Array(4 + rest.byteLength);
    reply.set(header, 0);
    reply.set(rest, 4);
    const crc = rest[length] | (rest[length + 1] << 8);
    if (crc !== modbusCRC16_lut(reply.subarray(0, 4 + length))) throw new Error('The updater\'s reply was damaged');
    if (header[1] !== 0) throw new Error(`Update failed: ${STATUS_TEXT[header[1]] ?? `status ${header[1]}`}`);
    return rest.subarray(0, length);
  }

  async info(): Promise<string> {
    return new TextDecoder().decode(await this.request(0x01));
  }

  /** Erases, writes and checks the firmware, then starts it. */
  async install(image: Uint8Array, version: string, onProgress: (done: number) => void): Promise<void> {
    await this.request(0x02, u32(image.length), 15000);
    const padded = new Uint8Array(image.length + (image.length & 1));
    padded.fill(0xff);
    padded.set(image);
    for (let offset = 0; offset < padded.length; offset += WRITE_CHUNK) {
      const chunk = padded.subarray(offset, Math.min(offset + WRITE_CHUNK, padded.length));
      const payload = new Uint8Array(4 + chunk.length);
      payload.set(u32(offset), 0);
      payload.set(chunk, 4);
      await this.request(0x03, payload, 5000);
      onProgress(Math.min(1, (offset + chunk.length) / padded.length));
    }
    await this.request(0x04, u32(image.length, crc32(image), versionNumber(version)), 5000);
    await this.request(0x05);
  }
}
