<template>
  <BaseModal
    v-model="localVisible"
    :title="$t('ui.firmware.title')"
    width="520px"
    @close="close"
  >
    <div class="firmware">
      <div class="row">
        <span class="label">{{ $t('ui.firmware.installed') }}</span>
        <span class="value">{{ installedText }}</span>
      </div>
      <div class="row">
        <span class="label">{{ $t('ui.firmware.latest') }}</span>
        <span class="value">{{ latest ? `JKL GBA Burner ${latest.version}` : $t('ui.firmware.unknown') }}</span>
      </div>

      <p
        v-if="needsStLink"
        class="note"
      >
        {{ $t('ui.firmware.needsStLink') }}
        <a
          :href="fullImageUrl"
          download
        >{{ $t('ui.firmware.downloadFull') }}</a>
      </p>

      <p
        v-if="stepText"
        class="step"
        :class="{ error: failed, done: finished }"
      >
        {{ stepText }}
      </p>
      <div
        v-if="progress > 0 && !finished && !failed"
        class="bar"
      >
        <div
          class="fill"
          :style="{ width: `${Math.round(progress * 100)}%` }"
        />
      </div>

      <div class="actions">
        <BaseButton
          v-if="stage === 'ready' && canRestart"
          variant="primary"
          :disabled="!image || busy"
          :text="$t('ui.firmware.update', { version: imageVersion })"
          @click="startUpdate"
        />
        <BaseButton
          v-if="stage === 'select-updater' || (stage === 'ready' && !canRestart)"
          variant="primary"
          :disabled="!image || busy"
          :text="$t('ui.firmware.connectUpdater')"
          @click="connectUpdater"
        />
        <BaseButton
          variant="secondary"
          :disabled="busy"
          :text="$t('ui.firmware.chooseFile')"
          @click="fileInput?.click()"
        />
        <input
          ref="fileInput"
          type="file"
          accept=".bin"
          hidden
          @change="onFileChosen"
        >
      </div>
      <p class="hint">
        {{ $t('ui.firmware.hint') }}
      </p>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseButton from '@/components/common/BaseButton.vue';
import BaseModal from '@/components/common/BaseModal.vue';
import {
  type BurnerFirmwareInfo,
  type FirmwareManifest,
  LATEST_FIRMWARE_MANIFEST,
  readFirmwareInfo,
  restartIntoUpdater,
  UPDATER_PORT_FILTER,
  UpdaterSession,
} from '@/services/jkl-firmware';
import type { DeviceInfo } from '@/types/device-info';

const props = defineProps<{ device?: DeviceInfo | null }>();
const localVisible = defineModel<boolean>({ default: false });
const { t } = useI18n();

type Stage = 'ready' | 'select-updater' | 'working' | 'done';

const stage = ref<Stage>('ready');
const busy = ref(false);
const installed = ref<BurnerFirmwareInfo | null | undefined>(undefined);
const latest = ref<FirmwareManifest | null>(null);
const image = ref<Uint8Array | null>(null);
const imageVersion = ref('');
const progress = ref(0);
const stepText = ref('');
const failed = ref(false);
const finished = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const connected = computed(() => Boolean(props.device?.transport));
const canRestart = computed(() => connected.value && Boolean(installed.value?.bootloader));
const needsStLink = computed(() => connected.value && installed.value === null);
const fullImageUrl = computed(() => latest.value
  ? new URL(`firmware/jkl_gba_burner_full_v${latest.value.version}.hex`, document.baseURI).href
  : '#');
const installedText = computed(() => {
  if (!connected.value) return t('ui.firmware.notConnected');
  if (installed.value === undefined) return t('ui.firmware.checking');
  if (installed.value === null) return t('ui.firmware.original');
  return `${installed.value.name} ${installed.value.version}`;
});

watch(localVisible, (visible) => {
  if (visible) void open();
});

async function open() {
  stage.value = 'ready';
  failed.value = false;
  finished.value = false;
  progress.value = 0;
  stepText.value = '';
  installed.value = undefined;
  await loadLatest();
  const transport = props.device?.transport;
  installed.value = transport ? await readFirmwareInfo(transport) : undefined;
}

async function loadLatest() {
  try {
    const manifestUrl = new URL(LATEST_FIRMWARE_MANIFEST, document.baseURI);
    const manifest = await (await fetch(manifestUrl, { cache: 'no-store' })).json() as FirmwareManifest;
    const bytes = new Uint8Array(await (await fetch(new URL(manifest.file, manifestUrl))).arrayBuffer());
    latest.value = manifest;
    if (!image.value || imageVersion.value === manifest.version) {
      image.value = bytes;
      imageVersion.value = manifest.version;
    }
  } catch {
    latest.value = null;
  }
}

async function onFileChosen(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  image.value = new Uint8Array(await file.arrayBuffer());
  const match = /v?(\d+\.\d+\.\d+)/.exec(file.name);
  imageVersion.value = match ? match[1] : '0.0.0';
  stepText.value = t('ui.firmware.fileChosen', { name: file.name });
}

async function startUpdate() {
  const transport = props.device?.transport;
  if (!transport) return;
  busy.value = true;
  failed.value = false;
  stepText.value = t('ui.firmware.restarting');
  await restartIntoUpdater(transport);
  // Chrome only shows its port picker after a click, so the next step is a button.
  stage.value = 'select-updater';
  stepText.value = t('ui.firmware.selectUpdater');
  busy.value = false;
}

async function connectUpdater() {
  if (!image.value) return;
  busy.value = true;
  failed.value = false;
  let session: UpdaterSession | null = null;
  try {
    if (!navigator.serial) throw new Error(t('ui.firmware.noWebSerial'));
    const port = await navigator.serial.requestPort({ filters: [UPDATER_PORT_FILTER] });
    stage.value = 'working';
    stepText.value = t('ui.firmware.writing');
    session = await UpdaterSession.open(port);
    await session.info();
    await session.install(image.value, imageVersion.value, (done) => { progress.value = done; });
    stage.value = 'done';
    finished.value = true;
    stepText.value = t('ui.firmware.done', { version: imageVersion.value });
  } catch (error) {
    failed.value = true;
    stage.value = 'select-updater';
    stepText.value = error instanceof DOMException && error.name === 'NotFoundError'
      ? t('ui.firmware.noUpdaterPicked')
      : t('ui.firmware.failed', { reason: (error as Error).message });
  } finally {
    await session?.close();
    busy.value = false;
  }
}

function close() {
  localVisible.value = false;
}
</script>

<style scoped>
.firmware {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.row {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  font-size: var(--font-size-sm);
}

.label {
  color: var(--color-text-secondary);
}

.value {
  font-weight: var(--font-weight-semibold);
  text-align: right;
}

.note,
.hint,
.step {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.note {
  padding: var(--space-3);
  border: 1px solid var(--color-warning);
  border-radius: var(--radius-md);
  color: var(--color-text);
}

.step {
  color: var(--color-text);
}

.step.error {
  color: var(--color-error);
}

.step.done {
  color: var(--color-success);
}

.bar {
  height: 8px;
  border-radius: 4px;
  background: var(--color-bg-secondary, rgba(0, 0, 0, 0.1));
  overflow: hidden;
}

.fill {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.2s;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
