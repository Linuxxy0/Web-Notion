<script setup>
import { computed } from 'vue';

const props = defineProps({
  name: { type: String, required: true },
  size: { type: Number, default: 20 },
  stroke: { type: Number, default: 1.8 },
});

const viewBox = '0 0 24 24';
const iconMap = {
  menu: { type: 'lines', lines: [[5,7,19,7],[5,12,19,12],[5,17,19,17]] },
  search: { type: 'search' },
  all: { type: 'grid' },
  recent: { type: 'clock' },
  favorites: { type: 'star' },
  remote: { type: 'cloud' },
  local: { type: 'desktop' },
  recycle: { type: 'trash' },
  folder: { type: 'folder' },
  file: { type: 'file' },
  'file-sync': { type: 'file-sync' },
  'file-remote': { type: 'file-remote' },
  'file-local': { type: 'file-local' },
  settings: { type: 'sliders' },
  chevron: { type: 'chevron' },
  close: { type: 'close' },
  sparkle: { type: 'sparkle' },
  home: { type: 'home' },
  dot: { type: 'dot' },
};

const kind = computed(() => iconMap[props.name]?.type || 'file');
</script>

<template>
  <svg
    class="app-icon"
    :style="{ width: `${size}px`, height: `${size}px` }"
    :viewBox="viewBox"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <template v-if="kind === 'grid'">
      <rect x="4" y="4" width="6" height="6" rx="1.8" :stroke-width="stroke" />
      <rect x="14" y="4" width="6" height="6" rx="1.8" :stroke-width="stroke" />
      <rect x="4" y="14" width="6" height="6" rx="1.8" :stroke-width="stroke" />
      <rect x="14" y="14" width="6" height="6" rx="1.8" :stroke-width="stroke" />
    </template>
    <template v-else-if="kind === 'clock'">
      <circle cx="12" cy="12" r="8" :stroke-width="stroke" />
      <path d="M12 8.3V12L15.2 13.9" :stroke-width="stroke" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="kind === 'star'">
      <path d="M12 4.6L14.27 9.2L19.35 9.94L15.68 13.52L16.55 18.56L12 16.16L7.45 18.56L8.32 13.52L4.65 9.94L9.73 9.2L12 4.6Z" :stroke-width="stroke" stroke-linejoin="round" />
    </template>
    <template v-else-if="kind === 'cloud'">
      <path d="M7.2 17.8H17.1C19.37 17.8 21.2 16.06 21.2 13.9C21.2 11.93 19.67 10.3 17.72 10.05C17.17 7.55 14.96 5.7 12.32 5.7C9.51 5.7 7.16 7.8 6.84 10.53C4.96 10.85 3.6 12.43 3.6 14.28C3.6 16.23 5.2 17.8 7.2 17.8Z" :stroke-width="stroke" stroke-linejoin="round" />
    </template>
    <template v-else-if="kind === 'desktop'">
      <rect x="3.8" y="4.8" width="16.4" height="11.2" rx="2.2" :stroke-width="stroke" />
      <path d="M9.2 19.2H14.8" :stroke-width="stroke" stroke-linecap="round" />
      <path d="M10.7 16.1L9.8 19.2" :stroke-width="stroke" stroke-linecap="round" />
      <path d="M13.3 16.1L14.2 19.2" :stroke-width="stroke" stroke-linecap="round" />
    </template>
    <template v-else-if="kind === 'trash'">
      <path d="M5.4 7.5H18.6" :stroke-width="stroke" stroke-linecap="round" />
      <path d="M9.3 4.8H14.7" :stroke-width="stroke" stroke-linecap="round" />
      <path d="M7.2 7.5L8 18.2C8.09 19.32 9.02 20.2 10.15 20.2H13.85C14.98 20.2 15.91 19.32 16 18.2L16.8 7.5" :stroke-width="stroke" stroke-linejoin="round" />
      <path d="M10.1 10.2V16" :stroke-width="stroke" stroke-linecap="round" />
      <path d="M13.9 10.2V16" :stroke-width="stroke" stroke-linecap="round" />
    </template>
    <template v-else-if="kind === 'folder'">
      <path d="M3.8 8.6C3.8 7.39 4.79 6.4 6 6.4H9.2L10.7 8.1H18C19.21 8.1 20.2 9.09 20.2 10.3V16.9C20.2 18.11 19.21 19.1 18 19.1H6C4.79 19.1 3.8 18.11 3.8 16.9V8.6Z" :stroke-width="stroke" stroke-linejoin="round" />
    </template>
    <template v-else-if="kind === 'file' || kind === 'file-sync' || kind === 'file-remote' || kind === 'file-local'">
      <path d="M8.1 3.8H13.6L18.8 9V18.2C18.8 19.41 17.81 20.4 16.6 20.4H8.1C6.89 20.4 5.9 19.41 5.9 18.2V6C5.9 4.79 6.89 3.8 8.1 3.8Z" :stroke-width="stroke" stroke-linejoin="round" />
      <path d="M13.6 3.8V8.4C13.6 8.73 13.87 9 14.2 9H18.8" :stroke-width="stroke" stroke-linejoin="round" />
      <path v-if="kind === 'file-sync'" d="M9.1 15.4C9.8 16.4 11.13 17.1 12.4 17.1C13.72 17.1 15.03 16.37 15.7 15.2M15.1 12.5C14.4 11.5 13.07 10.9 11.8 10.9C10.48 10.9 9.17 11.53 8.5 12.8" :stroke-width="stroke" stroke-linecap="round" />
      <path v-else-if="kind === 'file-remote'" d="M9.1 15.7H15.5M10.4 13.1C10.92 12.12 11.79 11.5 12.8 11.5C13.83 11.5 14.73 12.15 15.2 13.2" :stroke-width="stroke" stroke-linecap="round" />
      <path v-else-if="kind === 'file-local'" d="M9.1 15.8L11.1 13.8L12.7 15.4L15.4 12.7" :stroke-width="stroke" stroke-linecap="round" stroke-linejoin="round" />
      <path v-else d="M9.1 15.7H15.5M9.1 12.5H13.7" :stroke-width="stroke" stroke-linecap="round" />
    </template>
    <template v-else-if="kind === 'sliders'">
      <path d="M5 7H19" :stroke-width="stroke" stroke-linecap="round" />
      <path d="M5 17H19" :stroke-width="stroke" stroke-linecap="round" />
      <circle cx="9" cy="7" r="2" :stroke-width="stroke" />
      <circle cx="15" cy="17" r="2" :stroke-width="stroke" />
    </template>
    <template v-else-if="kind === 'home'">
      <path d="M4.3 11.2L12 4.6L19.7 11.2" :stroke-width="stroke" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M6.9 10.4V18.6C6.9 19.37 7.53 20 8.3 20H15.7C16.47 20 17.1 19.37 17.1 18.6V10.4" :stroke-width="stroke" stroke-linejoin="round" />
    </template>
    <template v-else-if="kind === 'search'">
      <circle cx="10.5" cy="10.5" r="5.8" :stroke-width="stroke" />
      <path d="M14.9 14.9L19.2 19.2" :stroke-width="stroke" stroke-linecap="round" />
    </template>
    <template v-else-if="kind === 'close'">
      <path d="M6.2 6.2L17.8 17.8" :stroke-width="stroke" stroke-linecap="round" />
      <path d="M17.8 6.2L6.2 17.8" :stroke-width="stroke" stroke-linecap="round" />
    </template>
    <template v-else-if="kind === 'sparkle'">
      <path d="M12 3.8L13.2 8.8L18.2 10L13.2 11.2L12 16.2L10.8 11.2L5.8 10L10.8 8.8L12 3.8Z" :stroke-width="stroke" stroke-linejoin="round" />
    </template>
    <template v-else-if="kind === 'dot'">
      <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="kind === 'chevron'">
      <path d="M9 6L15 12L9 18" :stroke-width="stroke" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="kind === 'lines'">
      <path d="M5 7H19" :stroke-width="stroke" stroke-linecap="round" />
      <path d="M5 12H19" :stroke-width="stroke" stroke-linecap="round" />
      <path d="M5 17H19" :stroke-width="stroke" stroke-linecap="round" />
    </template>
  </svg>
</template>

<style scoped>
.app-icon {
  display: block;
  color: currentColor;
}
.app-icon :deep(path),
.app-icon :deep(circle),
.app-icon :deep(rect) {
  stroke: currentColor;
}
</style>
