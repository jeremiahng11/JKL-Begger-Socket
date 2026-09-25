<template>
  <div
    v-if="isVisible"
    class="emulator-overlay"
    @click.self="!cartridgeSync && closeEmulator()"
  >
    <div class="emulator-container">
      <div class="emulator-header">
        <h3 class="emulator-title">
          {{ $t('ui.emulator.title') }} - {{ romName }}
        </h3>
        <div class="emulator-controls">
          <BaseButton
            v-if="cartridgeSync"
            variant="success"
            size="sm"
            :icon="saveOutline"
            :text="savingToCartridge ? $t('ui.play.saving') : $t('ui.play.saveToCart')"
            :disabled="savingToCartridge || hasError || loading"
            :title="$t('ui.play.saveToCart')"
            @click="saveToCartridge"
          />
          <BaseButton
            :variant="showCheats ? 'primary' : 'secondary'"
            size="sm"
            :icon="keyOutline"
            icon-only
            :disabled="hasError || loading"
            :title="$t('ui.emulator.cheats.title')"
            @click="toggleCheats"
          />
          <BaseButton
            variant="secondary"
            size="sm"
            :icon="isPaused ? play : pause"
            icon-only
            :disabled="hasError || loading"
            :title="$t('ui.emulator.pause')"
            @click="togglePause"
          />
          <BaseButton
            variant="warning"
            size="sm"
            :icon="refresh"
            icon-only
            :disabled="hasError || loading"
            :title="$t('ui.emulator.reset')"
            @click="resetGame"
          />
          <BaseButton
            variant="error"
            size="sm"
            :icon="close"
            icon-only
            :title="$t('ui.emulator.close')"
            @click="closeEmulator"
          />
        </div>
      </div>

      <div class="emulator-content">
        <div
          v-if="hasError"
          class="error-display"
        >
          <div class="error-icon">
            <IonIcon
              :icon="warning"
              class="error-icon"
            />
          </div>
          <h4>{{ $t('ui.emulator.errors.error') }}</h4>
          <p>{{ errorMessage }}</p>
          <BaseButton
            variant="primary"
            :text="$t('ui.emulator.retry')"
            @click="start"
          />
        </div>
        <template v-else>
          <p
            v-if="loading"
            class="loading-text"
          >
            {{ $t('ui.emulator.loading') }}...
          </p>
          <div
            ref="canvasHost"
            class="canvas-host"
            @pointerdown="resumeAudio"
          />
        </template>
      </div>

      <div
        v-if="showCheats && !hasError"
        class="cheats-panel"
      >
        <p class="cheats-hint">
          {{ $t('ui.emulator.cheats.hint') }}
        </p>
        <ul
          v-if="cheats.length"
          class="cheat-list"
        >
          <li
            v-for="(cheat, index) in cheats"
            :key="index"
            class="cheat-row"
          >
            <label class="cheat-toggle">
              <input
                v-model="cheat.enabled"
                type="checkbox"
                @change="applyCheats"
              >
              <span class="cheat-name">{{ cheat.name }}</span>
            </label>
            <button
              class="cheat-delete"
              :title="$t('ui.emulator.cheats.delete')"
              @click="deleteCheat(index)"
            >
              <IonIcon :icon="trashOutline" />
            </button>
          </li>
        </ul>
        <p
          v-else
          class="cheats-empty"
        >
          {{ $t('ui.emulator.cheats.empty') }}
        </p>
        <div class="cheat-form">
          <input
            v-model="newCheatName"
            class="cheat-input"
            type="text"
            :placeholder="$t('ui.emulator.cheats.namePlaceholder')"
          >
          <textarea
            v-model="newCheatCode"
            class="cheat-input cheat-code"
            rows="3"
            spellcheck="false"
            :placeholder="$t('ui.emulator.cheats.codePlaceholder')"
          />
          <BaseButton
            variant="primary"
            size="sm"
            :icon="addOutline"
            :text="$t('ui.emulator.cheats.add')"
            :disabled="!newCheatCode.trim()"
            @click="addCheat"
          />
        </div>
      </div>

      <div
        v-if="touchControls && !hasError"
        class="touch-pad"
      >
        <div class="touch-shoulders">
          <button
            v-for="name in ['L', 'R']"
            :key="name"
            class="touch-button shoulder"
            v-bind="touchHandlers(name)"
          >
            {{ name }}
          </button>
        </div>
        <div class="touch-main">
          <div class="touch-dpad">
            <button
              v-for="dir in dpad"
              :key="dir.name"
              :class="['touch-button', 'dpad', dir.name.toLowerCase()]"
              :aria-label="dir.name"
              v-bind="touchHandlers(dir.name)"
            >
              {{ dir.label }}
            </button>
          </div>
          <div class="touch-face">
            <button
              class="touch-button face b"
              v-bind="touchHandlers('B')"
            >
              B
            </button>
            <button
              class="touch-button face a"
              v-bind="touchHandlers('A')"
            >
              A
            </button>
          </div>
        </div>
        <div class="touch-system">
          <button
            class="touch-button system"
            v-bind="touchHandlers('Select')"
          >
            {{ $t('ui.emulator.select') }}
          </button>
          <button
            class="touch-button system"
            v-bind="touchHandlers('Start')"
          >
            {{ $t('ui.emulator.start') }}
          </button>
        </div>
      </div>

      <div class="emulator-footer">
        <div class="controls-help">
          <p>{{ $t('ui.emulator.controlsHelp') }}</p>
          <div class="key-mappings">
            <span class="key-mapping">{{ $t('ui.emulator.dpad') }}: ← ↑ → ↓</span>
            <span class="key-mapping">{{ $t('ui.emulator.aButton') }}: X</span>
            <span class="key-mapping">{{ $t('ui.emulator.bButton') }}: Z</span>
            <span class="key-mapping">{{ $t('ui.emulator.l') }}: A</span>
            <span class="key-mapping">{{ $t('ui.emulator.r') }}: S</span>
            <span class="key-mapping">{{ $t('ui.emulator.start') }}: Enter</span>
            <span class="key-mapping">{{ $t('ui.emulator.select') }}: Backspace</span>
          </div>
          <p class="gamepad-hint">
            {{ $t('ui.emulator.gamepadHint') }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { addOutline, close, keyOutline, pause, play, refresh, saveOutline, trashOutline, warning } from 'ionicons/icons';
import { nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseButton from '@/components/common/BaseButton.vue';
import { useToast } from '@/composables/useToast';
import { isCrossOriginIsolated, loadMgbaRuntime, MGBA_STATE_WITHOUT_CHEATS, type MgbaModule, removeFile } from '@/services/mgba-runtime';
import { type GameCheat, loadCheats, storeCheats, toMgbaCheatsFile } from '@/utils/mgba-cheats';
import { parseRom } from '@/utils/parsers/rom-parser';

const { t } = useI18n();
const { showToast } = useToast();

const props = defineProps<{
  isVisible: boolean;
  romData: Uint8Array | null;
  romName: string;
  /** Save data to load into the game, e.g. read from the cartridge. */
  saveData?: Uint8Array | null;
  /** Show the "save to cartridge" control and hand the save back on close. */
  cartridgeSync?: boolean;
  savingToCartridge?: boolean;
}>();

const emit = defineEmits<{
  close: [saveData: Uint8Array | null];
  'save-to-cartridge': [saveData: Uint8Array];
}>();

const canvasHost = useTemplateRef<HTMLDivElement>('canvasHost');
const loading = ref(false);
const hasError = ref(false);
const errorMessage = ref('');
const isPaused = ref(false);
const showCheats = ref(false);
const cheats = ref<GameCheat[]>([]);
const newCheatName = ref('');
const newCheatCode = ref('');
const touchControls = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

const dpad = [
  { name: 'Up', label: '▲' },
  { name: 'Left', label: '◀' },
  { name: 'Right', label: '▶' },
  { name: 'Down', label: '▼' },
];

// Behave like a real cartridge: once the game finishes writing its save, push it
// to the cartridge. mGBA reports save writes; a timer also catches any it misses.
const SAVE_SETTLE_MS = 1500;
const SAVE_POLL_MS = 2000;

let mgba: MgbaModule | null = null;
let canvas: HTMLCanvasElement | null = null;
let romPath = '';
let savePath = '';
let cheatsPath = '';
let gameKey = '';
// State slot used to carry the game across the reload that applies cheat changes.
const CHEAT_RELOAD_SLOT = 9;
let saveSettleTimer: ReturnType<typeof setTimeout> | null = null;
let savePollTimer: ReturnType<typeof setInterval> | null = null;
let lastSentSave: Uint8Array | null = null;
let sessionId = 0;

onMounted(() => {
  if (props.isVisible && props.romData) void start();
});

onUnmounted(() => {
  stop();
});

watch(() => [props.isVisible, props.romData] as const, ([visible, data]) => {
  if (visible && data) {
    void nextTick(() => start());
  } else if (!visible) {
    stop();
  }
});

function romExtension(): string {
  const match = /\.(gba|gbc|gb)$/i.exec(props.romName);
  if (match) return match[1].toLowerCase();
  const type = props.romData ? parseRom(props.romData).type : 'GBA';
  return type === 'GB' ? 'gb' : type === 'GBC' ? 'gbc' : 'gba';
}

function sameBytes(a: Uint8Array | null, b: Uint8Array | null): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function readSave(): Uint8Array | null {
  const save = mgba?.getSave();
  return save ? save.slice() : null;
}

async function start() {
  if (!props.romData || loading.value) return;
  const session = ++sessionId;
  hasError.value = false;
  errorMessage.value = '';
  loading.value = true;

  try {
    if (!isCrossOriginIsolated()) {
      throw new Error(t('ui.emulator.errors.notIsolated'));
    }
    const runtime = await loadMgbaRuntime();
    if (session !== sessionId) return;
    mgba = runtime.module;
    canvas = runtime.canvas;
    canvas.className = 'game-canvas';
    canvasHost.value?.appendChild(canvas);

    try {
      mgba.quitGame();
    } catch {
      // Nothing was running.
    }
    const paths = mgba.filePaths();
    romPath = `${paths.gamePath}/jkl-game.${romExtension()}`;
    savePath = `${paths.savePath}/jkl-game.sav`;
    cheatsPath = `${paths.cheatsPath}/jkl-game.cheats`;
    gameKey = cheatGameKey();
    cheats.value = loadCheats(gameKey);
    writeCheatsFile(); // mGBA loads this file together with the game
    // Only this session's save may be used; never a leftover from an earlier game.
    removeFile(mgba, savePath);
    if (props.saveData) mgba.FS.writeFile(savePath, props.saveData);
    mgba.FS.writeFile(romPath, props.romData);

    registerCallbacks();
    if (!mgba.loadGame(romPath, savePath)) {
      throw new Error(t('ui.emulator.errors.romLoadFailed'));
    }
    (document.activeElement as HTMLElement | null)?.blur(); // Enter must reach the game, not a button
    mgba.toggleInput(true);
    resumeAudio();
    isPaused.value = false;
    lastSentSave = readSave();
    if (props.cartridgeSync) savePollTimer = setInterval(scheduleCartridgeSave, SAVE_POLL_MS);
    showToast(t('ui.emulator.loaded'), 'success');
  } catch (error) {
    console.error('Failed to start mGBA:', error);
    hasError.value = true;
    errorMessage.value = error instanceof Error ? error.message : t('ui.emulator.errors.unknownError');
    showToast(t('ui.emulator.loadFailed'), 'error');
  } finally {
    if (session === sessionId) loading.value = false;
  }
}

function registerCallbacks() {
  mgba?.addCoreCallbacks({
    saveDataUpdatedCallback: scheduleCartridgeSave,
    coreCrashedCallback: () => {
      hasError.value = true;
      errorMessage.value = t('ui.emulator.errors.crashed');
    },
  });
}

function cheatGameKey(): string {
  if (!props.romData) return props.romName;
  const info = parseRom(props.romData);
  return `${info.gameCode ?? ''}:${info.title || props.romName}`;
}

function writeCheatsFile() {
  if (!mgba || !cheatsPath) return;
  removeFile(mgba, cheatsPath);
  if (cheats.value.length) {
    mgba.FS.writeFile(cheatsPath, new TextEncoder().encode(toMgbaCheatsFile(cheats.value)));
  }
}

/**
 * mGBA only adds cheats when asked to load them again, so a change is applied by
 * reloading the game with the new cheat file and restoring a snapshot (without
 * mGBA's own copy of the cheats) taken just before.
 */
function applyCheats() {
  storeCheats(gameKey, cheats.value);
  if (!mgba || loading.value || hasError.value) return;
  const wasPaused = isPaused.value;
  try {
    mgba.pauseGame();
    const saved = mgba.saveStateSlot(CHEAT_RELOAD_SLOT, MGBA_STATE_WITHOUT_CHEATS);
    writeCheatsFile();
    if (!mgba.loadGame(romPath, savePath)) throw new Error(t('ui.emulator.errors.romLoadFailed'));
    registerCallbacks();
    mgba.pauseGame();
    if (saved) mgba.loadStateSlot(CHEAT_RELOAD_SLOT, MGBA_STATE_WITHOUT_CHEATS);
    mgba.toggleInput(!showCheats.value);
    if (wasPaused) {
      isPaused.value = true;
    } else {
      mgba.resumeGame();
    }
    showToast(t('ui.emulator.cheats.applied'), 'success');
  } catch (error) {
    console.error('Failed to apply cheats:', error);
    showToast(t('ui.emulator.cheats.applyFailed'), 'error');
  }
}

function toggleCheats() {
  showCheats.value = !showCheats.value;
  // Typing a code must not press game buttons (A is mapped to L, for example).
  mgba?.toggleInput(!showCheats.value);
}

function addCheat() {
  const code = newCheatCode.value.trim();
  if (!code) return;
  cheats.value.push({
    name: newCheatName.value.trim() || t('ui.emulator.cheats.defaultName', { number: cheats.value.length + 1 }),
    code,
    enabled: true,
  });
  newCheatName.value = '';
  newCheatCode.value = '';
  applyCheats();
}

function deleteCheat(index: number) {
  cheats.value.splice(index, 1);
  applyCheats();
}

function scheduleCartridgeSave() {
  if (!props.cartridgeSync) return;
  if (saveSettleTimer) clearTimeout(saveSettleTimer);
  saveSettleTimer = setTimeout(pushCartridgeSave, SAVE_SETTLE_MS);
}

function pushCartridgeSave() {
  saveSettleTimer = null;
  if (props.savingToCartridge) {
    saveSettleTimer = setTimeout(pushCartridgeSave, SAVE_SETTLE_MS);
    return;
  }
  const save = readSave();
  if (!save || sameBytes(save, lastSentSave)) return;
  lastSentSave = save;
  emit('save-to-cartridge', save);
}

function saveToCartridge() {
  const save = readSave();
  if (!save) return;
  lastSentSave = save;
  emit('save-to-cartridge', save);
}

function resumeAudio() {
  try {
    mgba?.resumeAudio();
  } catch {
    // Audio starts on the next user gesture.
  }
}

function togglePause() {
  if (!mgba) return;
  if (isPaused.value) {
    mgba.resumeGame();
    isPaused.value = false;
    showToast(t('ui.emulator.resumed'), 'success');
  } else {
    mgba.pauseGame();
    isPaused.value = true;
    showToast(t('ui.emulator.paused'), 'success');
  }
}

function resetGame() {
  if (!mgba) return;
  try {
    mgba.quickReload();
    isPaused.value = false;
    showToast(t('ui.emulator.reset'), 'success');
  } catch (error) {
    console.error('Failed to reset game:', error);
    showToast(t('ui.emulator.resetFailed'), 'error');
  }
}

function touchHandlers(name: string) {
  const release = () => {
    mgba?.buttonUnpress(name);
  };
  return {
    onPointerdown: (event: PointerEvent) => {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      resumeAudio();
      mgba?.buttonPress(name);
    },
    onPointerup: release,
    onPointercancel: release,
    onLostpointercapture: release,
    onContextmenu: (event: Event) => {
      event.preventDefault();
    },
  };
}

function closeEmulator() {
  const finalSave = readSave();
  stop();
  emit('close', finalSave);
}

function stop() {
  sessionId += 1;
  if (saveSettleTimer) clearTimeout(saveSettleTimer);
  if (savePollTimer) clearInterval(savePollTimer);
  saveSettleTimer = null;
  savePollTimer = null;
  if (mgba) {
    try {
      mgba.quitGame();
    } catch (error) {
      console.warn('Error stopping mGBA:', error);
    }
    // The game only lives in memory for this session.
    removeFile(mgba, romPath);
    removeFile(mgba, savePath);
    removeFile(mgba, cheatsPath);
  }
  canvas?.remove();
  showCheats.value = false;
  mgba = null;
  isPaused.value = false;
  loading.value = false;
}
</script>

<style lang="scss" scoped>
@use '@/styles/variables/colors' as color-vars;
@use '@/styles/variables/spacing' as spacing-vars;
@use '@/styles/variables/typography' as typography-vars;
@use '@/styles/variables/radius' as radius-vars;
@use '@/styles/mixins' as mixins;

.emulator-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.emulator-container {
  background: color-vars.$color-bg;
  border-radius: radius-vars.$radius-xl;
  box-shadow: color-vars.$shadow-lg;
  overflow: hidden;
  width: min(540px, calc(100vw - 2rem));
  max-width: 90vw;
  max-height: calc(100vh - 2rem);
  display: flex;
  flex-direction: column;
}

.emulator-header {
  background: linear-gradient(135deg, #5bcffa 0%, #f5abb9 100%);
  color: #ffffff;
  padding: spacing-vars.$space-4 spacing-vars.$space-5;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.emulator-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin: 0;
  font-size: typography-vars.$font-size-lg;
  font-weight: typography-vars.$font-weight-semibold;
  display: flex;
  align-items: center;
  gap: spacing-vars.$space-2;
}

.emulator-controls {
  display: flex;
  gap: spacing-vars.$space-2;
  flex-shrink: 0;
}

.emulator-content {
  background: color-vars.$color-bg;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: spacing-vars.$space-5;
  min-width: 0;
  overflow: auto;
  min-height: 200px;
}

.error-display {
  text-align: center;
  padding: spacing-vars.$space-10 spacing-vars.$space-5;
  color: color-vars.$color-error;

  h4 {
    margin: 0 0 spacing-vars.$space-3 0;
    font-size: typography-vars.$font-size-xl;
    color: color-vars.$color-error;
  }

  p {
    margin: 0 0 spacing-vars.$space-5 0;
    color: color-vars.$color-text-secondary;
    line-height: typography-vars.$line-height-normal;
    max-width: 400px;
  }
}

.error-icon {
  font-size: typography-vars.$font-size-5xl;
  margin-bottom: spacing-vars.$space-4;
}

.canvas-host {
  display: flex;
  justify-content: center;
  width: 100%;
}

.loading-text {
  margin: 0;
  color: color-vars.$color-text-secondary;
}

.canvas-host :deep(.game-canvas),
.game-canvas {
  border: 2px solid color-vars.$color-text;
  border-radius: radius-vars.$radius-base;
  background: #000000;
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
  max-width: 100%;
  max-height: 100%;
  width: min(480px, 100%);
  height: auto;
  aspect-ratio: 240 / 160;
  /* GBA屏幕比例 240x160，放大到合适尺寸 */
}

.emulator-footer {
  background: color-vars.$color-bg-secondary;
  color: color-vars.$color-text;
  padding: spacing-vars.$space-4 spacing-vars.$space-5;
  border-top: 1px solid color-vars.$color-border-light;
}

.controls-help {
  text-align: center;

  p {
    margin: 0 0 spacing-vars.$space-3 0;
    font-size: typography-vars.$font-size-sm;
    color: color-vars.$color-text-secondary;
  }
}

.key-mappings {
  display: flex;
  flex-wrap: wrap;
  gap: spacing-vars.$space-3;
  justify-content: center;
  align-items: center;
}

.key-mapping {
  background: color-vars.$color-bg-tertiary;
  padding: spacing-vars.$space-1 spacing-vars.$space-2;
  border-radius: radius-vars.$radius-base;
  font-size: typography-vars.$font-size-xs;
  color: color-vars.$color-text;
  border: 1px solid color-vars.$color-border;
}
.gamepad-hint {
  margin: spacing-vars.$space-3 0 0 0 !important;
}

.touch-pad {
  display: flex;
  flex-direction: column;
  gap: spacing-vars.$space-3;
  padding: spacing-vars.$space-3 spacing-vars.$space-4;
  background: color-vars.$color-bg-secondary;
  user-select: none;
  touch-action: none;
}

.touch-shoulders,
.touch-system {
  display: flex;
  justify-content: space-between;
  gap: spacing-vars.$space-3;
}

.touch-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.touch-dpad {
  display: grid;
  grid-template-columns: repeat(3, 44px);
  grid-template-rows: repeat(3, 44px);
  gap: 2px;

  .up { grid-area: 1 / 2; }
  .left { grid-area: 2 / 1; }
  .right { grid-area: 2 / 3; }
  .down { grid-area: 3 / 2; }
}

.touch-face {
  display: flex;
  gap: spacing-vars.$space-3;
  align-items: flex-end;

  .a { margin-bottom: 24px; }
}

.touch-button {
  border: 1px solid color-vars.$color-border;
  background: color-vars.$color-bg-tertiary;
  color: color-vars.$color-text;
  font-weight: typography-vars.$font-weight-semibold;
  touch-action: none;

  &:active { filter: brightness(0.85); }

  &.dpad { border-radius: radius-vars.$radius-base; }
  &.face { width: 60px; height: 60px; border-radius: 50%; font-size: typography-vars.$font-size-lg; }
  &.shoulder { flex: 1; height: 40px; border-radius: radius-vars.$radius-lg; }
  &.system { flex: 1; height: 34px; border-radius: 999px; font-size: typography-vars.$font-size-sm; }
}
.cheats-panel {
  padding: spacing-vars.$space-3 spacing-vars.$space-5;
  border-top: 1px solid color-vars.$color-border-light;
  max-height: 40vh;
  overflow-y: auto;
}

.cheats-hint,
.cheats-empty {
  margin: 0 0 spacing-vars.$space-3 0;
  font-size: typography-vars.$font-size-sm;
  color: color-vars.$color-text-secondary;
}

.cheat-list {
  list-style: none;
  margin: 0 0 spacing-vars.$space-3 0;
  padding: 0;
}

.cheat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: spacing-vars.$space-2;
  padding: spacing-vars.$space-1 0;
}

.cheat-toggle {
  display: flex;
  align-items: center;
  gap: spacing-vars.$space-2;
  min-width: 0;
  cursor: pointer;
}

.cheat-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cheat-delete {
  border: none;
  background: none;
  color: color-vars.$color-text-secondary;
  cursor: pointer;
  font-size: typography-vars.$font-size-lg;
}

.cheat-form {
  display: flex;
  flex-direction: column;
  gap: spacing-vars.$space-2;
}

.cheat-input {
  width: 100%;
  box-sizing: border-box;
  padding: spacing-vars.$space-2;
  border: 1px solid color-vars.$color-border;
  border-radius: radius-vars.$radius-base;
  background: color-vars.$color-bg;
  color: color-vars.$color-text;
  font-size: typography-vars.$font-size-sm;
}

.cheat-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  resize: vertical;
}
</style>
