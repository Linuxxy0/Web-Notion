<script setup>
import TreeNode from './TreeNode.vue';

defineProps({
  tree: { type: Object, required: true },
  selectedFolder: { type: String, default: '' },
});

const emit = defineEmits(['select', 'contextmenu']);

function onRootContextMenu(event) {
  event.preventDefault();
  emit('contextmenu', {
    event,
    node: {
      id: 'root',
      type: 'folder',
      name: '全部文件',
      path: '',
      files: 0,
      depth: 0,
      children: [],
    },
  });
}
</script>

<template>
  <section class="card sidebar-card">
    <div class="section-title-row">
      <div>
        <h2>目录树</h2>
        <p class="muted">本地与远端合并视图，支持右键菜单</p>
      </div>
      <button class="text-button" @click="emit('select', '')">全部</button>
    </div>

    <ul class="tree-root" @contextmenu="onRootContextMenu">
      <TreeNode :node="tree" :selected-folder="selectedFolder" @select="emit('select', $event)" @contextmenu="emit('contextmenu', $event)" />
    </ul>
  </section>
</template>
