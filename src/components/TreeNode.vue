<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  node: { type: Object, required: true },
  selectedFolder: { type: String, default: '' },
});

const emit = defineEmits(['select', 'contextmenu']);
const expanded = ref(props.node.depth < 2);
const hasChildren = computed(() => (props.node.children || []).length > 0);
const active = computed(() => props.selectedFolder === props.node.path);

function onSelect() {
  emit('select', props.node.path);
  if (hasChildren.value) {
    expanded.value = !expanded.value;
  }
}

function onContextMenu(event) {
  event.preventDefault();
  emit('contextmenu', { event, node: props.node });
}
</script>

<template>
  <li class="tree-node">
    <div class="tree-label" :class="{ active }" @click="onSelect" @contextmenu="onContextMenu">
      <span class="tree-caret">{{ hasChildren ? (expanded ? '▾' : '▸') : '•' }}</span>
      <span class="tree-name">{{ node.name }}</span>
      <span class="tree-count">{{ node.files }}</span>
    </div>
    <ul v-if="hasChildren && expanded" class="tree-children">
      <TreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :selected-folder="selectedFolder"
        @select="emit('select', $event)"
        @contextmenu="emit('contextmenu', $event)"
      />
    </ul>
  </li>
</template>
