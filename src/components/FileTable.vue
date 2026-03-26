<script setup>
import { computed } from 'vue';
import AppIcon from './AppIcon.vue';

const props = defineProps({
  items: { type: Array, required: true },
  selectedItemId: { type: String, default: '' },
  selectedIds: { type: Array, required: true },
  busy: { type: Boolean, default: false },
  viewMode: { type: String, default: 'list' },
  formatBytes: { type: Function, required: true },
  formatDateTime: { type: Function, required: true },
});

const emit = defineEmits(['select', 'open', 'toggle-check', 'preview', 'sync', 'download', 'delete-remote', 'contextmenu', 'favorite']);

const emptyText = computed(() => (props.busy ? '正在处理，请稍候…' : '当前没有符合条件的文件或文件夹'));
const visibleBytes = computed(() => props.items.reduce((sum, item) => sum + (item.size || 0), 0));

function statusClass(status) {
  return {
    'badge-success': status === '已同步',
    'badge-warning': status === '待上传' || status === '待更新',
    'badge-muted': status === '仅远端' || status === '文件夹' || status === '已移除',
  };
}

function itemSource(item) {
  if (item.type === 'folder') return `${item.fileCount || 0} 个文件`;
  if (item.type === 'trash') return '回收区记录';
  return item.sourceLabel || `${item.local ? '本地' : ''}${item.local && item.remote ? ' / ' : ''}${item.remote ? '远端' : ''}`;
}

function canCheck(item) {
  return item.type === 'file';
}

function onContextMenu(event, item) {
  event.preventDefault();
  emit('contextmenu', { event, item });
}
</script>

<template>
  <section class="card explorer-card">
    <div class="section-title-row explorer-head">
      <div>
        <h2>文件列表</h2>
        <p class="muted">双击打开，单击查看属性，右键查看更多操作。</p>
      </div>
      <div class="table-summary-badges">
        <span class="pill pill-muted">{{ items.length }} 项</span>
        <span class="pill pill-muted">总大小 {{ formatBytes(visibleBytes) }}</span>
        <span class="pill">{{ viewMode === 'cards' ? '卡片视图' : '列表视图' }}</span>
      </div>
    </div>

    <div v-if="!items.length" class="empty-state large-empty-state">{{ emptyText }}</div>

    <div v-else-if="viewMode === 'cards'" class="resource-card-grid">
      <article
        v-for="item in items"
        :key="item.id"
        class="resource-card"
        :class="{ selected: selectedItemId === item.id, folder: item.type === 'folder', trash: item.type === 'trash' }"
        @click="emit('select', item)"
        @dblclick="emit('open', item)"
        @contextmenu="onContextMenu($event, item)"
      >
        <div class="resource-card-top">
          <div class="resource-icon-shell" :class="`kind-${item.type}`">
            <AppIcon :name="item.icon || (item.type === 'folder' ? 'folder' : 'file')" :size="20" />
          </div>
          <div class="resource-card-head-actions">
            <label v-if="canCheck(item)" class="checkbox-inline" @click.stop>
              <input :checked="selectedIds.includes(item.id)" type="checkbox" @change="emit('toggle-check', item)" />
            </label>
            <button class="favorite-toggle" @click.stop="emit('favorite', item)">
              <AppIcon :name="item.favorite ? 'favorites' : 'dot'" :size="14" />
            </button>
          </div>
        </div>

        <div class="resource-title-wrap">
          <strong class="resource-title">{{ item.name }}</strong>
          <p class="muted mono clamp-two">{{ item.relativePath || item.path || '/' }}</p>
        </div>

        <div class="resource-meta-grid">
          <span class="status-badge" :class="statusClass(item.status)">{{ item.status }}</span>
          <span class="pill pill-muted">{{ itemSource(item) }}</span>
          <span class="pill pill-muted">{{ formatBytes(item.size || 0) }}</span>
          <span class="pill pill-muted">{{ formatDateTime(item.updatedAt || item.deletedAt) }}</span>
        </div>

        <div class="resource-actions" @click.stop>
          <button class="mini-button" @click="item.type === 'folder' ? emit('open', item) : emit('preview', item)">
            {{ item.type === 'folder' ? '打开' : '预览' }}
          </button>
          <button v-if="item.type === 'file'" class="mini-button" :disabled="!['待上传', '待更新'].includes(item.status)" @click="emit('sync', item)">同步</button>
          <button v-if="item.type === 'file'" class="mini-button" :disabled="!item.remote" @click="emit('download', item)">下载</button>
          <button v-if="item.type === 'file'" class="mini-button danger" :disabled="!(item.remote && !item.local)" @click="emit('delete-remote', item)">删远端</button>
        </div>
      </article>
    </div>

    <div v-else class="resource-table-wrap">
      <table class="resource-table">
        <thead>
          <tr>
            <th class="checkbox-col"></th>
            <th>名称</th>
            <th>路径</th>
            <th>状态</th>
            <th>来源 / 类型</th>
            <th>大小</th>
            <th>时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in items"
            :key="item.id"
            :class="{ selected: selectedItemId === item.id }"
            @click="emit('select', item)"
            @dblclick="emit('open', item)"
            @contextmenu="onContextMenu($event, item)"
          >
            <td class="checkbox-col">
              <label v-if="canCheck(item)" class="checkbox-inline" @click.stop>
                <input :checked="selectedIds.includes(item.id)" type="checkbox" @change="emit('toggle-check', item)" />
              </label>
            </td>
            <td>
              <div class="name-cell">
                <span class="table-icon"><AppIcon :name="item.icon || (item.type === 'folder' ? 'folder' : 'file')" :size="18" /></span>
                <div>
                  <strong>{{ item.name }}</strong>
                  <button class="favorite-inline" @click.stop="emit('favorite', item)"><AppIcon :name="item.favorite ? 'favorites' : 'dot'" :size="12" /></button>
                </div>
              </div>
            </td>
            <td class="mono">{{ item.relativePath || item.path || '/' }}</td>
            <td>
              <span class="status-badge" :class="statusClass(item.status)">{{ item.status }}</span>
            </td>
            <td>{{ itemSource(item) }}</td>
            <td>{{ formatBytes(item.size || 0) }}</td>
            <td>{{ formatDateTime(item.updatedAt || item.deletedAt) }}</td>
            <td>
              <div class="action-group nowrap-actions" @click.stop>
                <button class="mini-button" @click="item.type === 'folder' ? emit('open', item) : emit('preview', item)">{{ item.type === 'folder' ? '打开' : '预览' }}</button>
                <button v-if="item.type === 'file'" class="mini-button" :disabled="!['待上传', '待更新'].includes(item.status)" @click="emit('sync', item)">同步</button>
                <button v-if="item.type === 'file'" class="mini-button" :disabled="!item.remote" @click="emit('download', item)">下载</button>
                <button v-if="item.type === 'file'" class="mini-button danger" :disabled="!(item.remote && !item.local)" @click="emit('delete-remote', item)">删远端</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
