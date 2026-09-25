import ChipOperations from './ChipOperations.vue';
import PlayOperations from './PlayOperations.vue';
import RamOperations from './RamOperations.vue';
import RomOperations from './RomOperations.vue';

export { default as ChipOperations } from './ChipOperations.vue';
export {
  CHIP_OPERATION_EVENTS,
  type ChipOperationsProps,
  RAM_OPERATION_EVENTS,
  type RamOperationsProps,
  ROM_OPERATION_EVENTS,
  type RomOperationsProps,
} from './contracts';
export { default as PlayOperations } from './PlayOperations.vue';
export { default as RamOperations } from './RamOperations.vue';
export { default as RomOperations } from './RomOperations.vue';

// 默认导出
export default {
  ChipOperations,
  PlayOperations,
  RamOperations,
  RomOperations,
};
