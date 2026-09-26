<template>
  <p
    v-if="supported"
    class="save-folder-hint"
  >
    <IonIcon
      :icon="folderOutline"
      class="save-folder-icon"
    />
    <template v-if="saveFolderName">
      <span>{{ $t('ui.saveFolder.savesTo') }} <strong>{{ saveFolderName }}</strong></span>
    </template>
    <span v-else>{{ $t('ui.saveFolder.notChosen') }}</span>
    <button
      type="button"
      class="save-folder-change"
      @click="chooseSaveFolder"
    >
      {{ saveFolderName ? $t('ui.saveFolder.change') : $t('ui.saveFolder.choose') }}
    </button>
  </p>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { folderOutline } from 'ionicons/icons';
import { onMounted } from 'vue';

import { chooseSaveFolder, initSaveFolder, saveFolderName, supportsSaveFolder } from '@/platform/save-folder';

const supported = supportsSaveFolder();

onMounted(() => {
  void initSaveFolder();
});
</script>

<style scoped>
.save-folder-hint {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: var(--space-2) 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.save-folder-icon {
  flex-shrink: 0;
}

.save-folder-change {
  padding: 0;
  border: none;
  background: none;
  color: var(--color-primary);
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}
</style>
