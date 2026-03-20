<script setup>
defineProps({
  inspector: { type: Object, default: null },
  preview: { type: Object, required: true },
  formatBytes: { type: Function, required: true },
  formatDateTime: { type: Function, required: true },
});

const emit = defineEmits(['preview-local', 'preview-remote', 'download', 'navigate-folder']);
</script>

<template>
  <section class="drawer-panel">
    <template v-if="inspector">
      <div class="properties-overview">
        <div class="properties-hero">
          <div class="properties-icon">{{ inspector.type === 'folder' ? '📁' : '📄' }}</div>
          <div>
            <h3>{{ inspector.name || '全部文件' }}</h3>
            <p class="muted mono">{{ inspector.type === 'folder' ? (inspector.path || '/') : inspector.relativePath }}</p>
          </div>
        </div>
        <div class="property-grid">
          <div class="property-item">
            <span class="property-label">类型</span>
            <strong>{{ inspector.type === 'folder' ? '文件夹' : 'TXT 文件' }}</strong>
          </div>
          <div class="property-item">
            <span class="property-label">更新时间</span>
            <strong>{{ formatDateTime(inspector.updatedAt) }}</strong>
          </div>
          <div class="property-item">
            <span class="property-label">大小</span>
            <strong>{{ formatBytes(inspector.type === 'folder' ? inspector.totalSize : inspector.size) }}</strong>
          </div>
          <div v-if="inspector.type === 'file'" class="property-item">
            <span class="property-label">同步状态</span>
            <strong>{{ inspector.status }}</strong>
          </div>
          <div v-if="inspector.type === 'file'" class="property-item">
            <span class="property-label">来源</span>
            <strong>{{ inspector.sourceLabel }}</strong>
          </div>
          <div v-if="inspector.type === 'folder'" class="property-item">
            <span class="property-label">内部文件数</span>
            <strong>{{ inspector.fileCount }}</strong>
          </div>
          <div v-if="inspector.type === 'folder'" class="property-item">
            <span class="property-label">直接子项数</span>
            <strong>{{ inspector.childrenCount }}</strong>
          </div>
          <div v-if="inspector.type === 'folder'" class="property-item">
            <span class="property-label">待同步</span>
            <strong>{{ inspector.pendingCount }}</strong>
          </div>
          <div v-if="inspector.type === 'folder'" class="property-item">
            <span class="property-label">仅远端</span>
            <strong>{{ inspector.remoteOnlyCount }}</strong>
          </div>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section-title">常用操作</div>
        <div v-if="inspector.type === 'file'" class="button-row compact wrap-row">
          <button class="button" :disabled="!inspector.local" @click="emit('preview-local')">预览本地</button>
          <button class="button" :disabled="!inspector.remote" @click="emit('preview-remote')">预览远端</button>
          <button class="button button-primary" :disabled="!inspector.remote" @click="emit('download')">下载远端</button>
        </div>
        <div v-else class="button-row compact wrap-row">
          <button class="button button-primary" @click="emit('navigate-folder', inspector.path)">打开文件夹</button>
        </div>
      </div>

      <div v-if="inspector.type === 'file'" class="drawer-section">
        <div class="drawer-section-title">预览信息</div>
        <div class="preview-meta meta-stack">
          <span class="pill pill-muted">来源：{{ preview.source || '-' }}</span>
          <span class="pill pill-muted">编码：{{ preview.encoding || '-' }}</span>
          <span class="pill pill-muted">更新时间：{{ formatDateTime(preview.updatedAt) }}</span>
        </div>

        <div v-if="preview.error" class="error-box">{{ preview.error }}</div>
        <pre v-else class="preview-text drawer-preview">{{ preview.text || '点击“预览本地”或“预览远端”查看内容' }}</pre>
      </div>

      <div v-else class="drawer-section">
        <div class="drawer-section-title">文件夹摘要</div>
        <div class="folder-hint-grid">
          <div class="folder-hint-card">
            <span class="property-label">总大小</span>
            <strong>{{ formatBytes(inspector.totalSize) }}</strong>
          </div>
          <div class="folder-hint-card">
            <span class="property-label">最近修改</span>
            <strong>{{ formatDateTime(inspector.updatedAt) }}</strong>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="empty-state">请选择一个文件或文件夹查看属性</div>
  </section>
</template>
