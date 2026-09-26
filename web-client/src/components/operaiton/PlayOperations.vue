<template>
  <div class="rom-operations-container">
    <section class="section play-card">
      <div class="section-header">
        <div class="op-title-row">
          <span :class="['op-title', { busy }]">{{ $t('ui.play.title') }}</span>
        </div>
      </div>
      <p class="play-hint">
        {{ $t('ui.play.hint') }}
      </p>
      <div
        v-if="hasPendingSave"
        class="pending-save"
      >
        <span>{{ $t('ui.play.pendingSave') }}</span>
        <div class="button-row">
          <BaseButton
            :disabled="!deviceReady || busy"
            variant="warning"
            :text="$t('ui.play.retrySave')"
            @click="$emit('retry-save')"
          />
          <BaseButton
            variant="secondary"
            :text="$t('ui.play.downloadSave')"
            @click="$emit('download-save')"
          />
        </div>
      </div>
      <div class="button-row">
        <BaseButton
          :disabled="!deviceReady || busy"
          variant="success"
          :icon="playOutline"
          :text="$t('ui.play.start')"
          @click="$emit('play')"
        />
      </div>
      <p
        v-if="!deviceReady"
        class="play-hint play-hint--center"
      >
        {{ $t('ui.play.connectFirst') }}
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { playOutline } from 'ionicons/icons';

import BaseButton from '@/components/common/BaseButton.vue';

defineProps<{
  deviceReady: boolean;
  busy: boolean;
  hasPendingSave: boolean;
}>();

defineEmits<{
  play: [];
  'retry-save': [];
  'download-save': [];
}>();
</script>

<style scoped>
.section {
  margin-bottom: var(--space-7);
}

.play-card {
  padding: var(--space-2) var(--space-4) var(--space-3);
  border: 1px solid color-mix(in srgb, var(--color-primary) 35%, transparent);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--color-primary) 6%, transparent);
  margin-bottom: var(--space-6, 24px);
}

.play-hint--center {
  margin: var(--space-2) 0 0;
  text-align: center;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-top: var(--space-4);
  margin-bottom: var(--space-2);
  gap: var(--space-3);
  flex-wrap: wrap;
}

.op-title-row {
  display: flex;
  align-items: center;
  margin-bottom: var(--space-3);
  min-width: 0;
}

.op-title {
  font-size: var(--font-size-lg);
  color: var(--color-text);
  font-weight: var(--font-weight-semibold);
  transition: color 0.2s, font-weight 0.2s;
  white-space: nowrap;
}

.op-title.busy {
  color: var(--color-warning);
  font-weight: bold;
}

.play-hint {
  margin: 0 0 var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.pending-save {
  margin-bottom: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-warning);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.pending-save .button-row {
  margin-top: var(--space-2);
}

.button-row {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
  flex-wrap: wrap;
  min-width: 0;
}

.button-row > * {
  flex: 1 1 auto;
}
</style>
