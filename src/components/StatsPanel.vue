<script setup>
import { computed } from 'vue';

const props = defineProps({
  entries: { type: Array, required: true },
  visibleEntries: { type: Array, required: true },
  metricsHistory: { type: Array, required: true },
  pendingCount: { type: Number, required: true },
  remoteOnlyCount: { type: Number, required: true },
  lastSyncSummary: { type: Object, default: null },
  formatBytes: { type: Function, required: true },
  formatDateTime: { type: Function, required: true },
});

const allBytes = computed(() => props.entries.reduce((sum, item) => sum + (item.size || 0), 0));
const localBytes = computed(() => props.entries.filter((item) => item.local).reduce((sum, item) => sum + (item.local?.size || 0), 0));
const remoteBytes = computed(() => props.entries.filter((item) => item.remote).reduce((sum, item) => sum + (item.remote?.size || 0), 0));
const visibleBytes = computed(() => props.visibleEntries.reduce((sum, item) => sum + (item.size || 0), 0));
const averageSize = computed(() => (props.entries.length ? allBytes.value / props.entries.length : 0));
const largestEntries = computed(() => [...props.entries].sort((a, b) => (b.size || 0) - (a.size || 0)).slice(0, 5));

const cards = computed(() => {
  const totalFiles = props.entries.length;
  const localFiles = props.entries.filter((item) => item.local).length;
  const remoteFiles = props.entries.filter((item) => item.remote).length;
  return [
    { label: '总文件数', value: String(totalFiles) },
    { label: '本地文件', value: String(localFiles) },
    { label: '远端文件', value: String(remoteFiles) },
    { label: '总容量估算', value: props.formatBytes(allBytes.value) },
    { label: '当前筛选容量', value: props.formatBytes(visibleBytes.value) },
    { label: '平均文件大小', value: props.formatBytes(averageSize.value) },
    { label: '待同步', value: String(props.pendingCount) },
    { label: '仅远端', value: String(props.remoteOnlyCount) },
  ];
});

const recentMetrics = computed(() => props.metricsHistory.slice(-7));
const maxUpload = computed(() => Math.max(1, ...recentMetrics.value.map((item) => item.uploadBytes || 0)));

const sizeBuckets = computed(() => {
  const buckets = [
    { label: '< 100KB', count: 0, bytes: 0, test: (size) => size < 100 * 1024 },
    { label: '100KB - 1MB', count: 0, bytes: 0, test: (size) => size >= 100 * 1024 && size < 1024 * 1024 },
    { label: '1MB - 5MB', count: 0, bytes: 0, test: (size) => size >= 1024 * 1024 && size < 5 * 1024 * 1024 },
    { label: '>= 5MB', count: 0, bytes: 0, test: (size) => size >= 5 * 1024 * 1024 },
  ];

  for (const entry of props.entries) {
    const size = entry.size || 0;
    const target = buckets.find((bucket) => bucket.test(size));
    if (target) {
      target.count += 1;
      target.bytes += size;
    }
  }

  return buckets;
});
</script>

<template>
  <section class="card sidebar-card">
    <div class="section-title-row">
      <div>
        <h2>流量与统计</h2>
        <p class="muted">同步流量、本地视图大小、文件体积分布都保存在浏览器。</p>
      </div>
    </div>

    <div class="stats-grid stats-grid-rich">
      <div v-for="card in cards" :key="card.label" class="stat-card stat-card-accent">
        <span class="muted">{{ card.label }}</span>
        <strong>{{ card.value }}</strong>
      </div>
    </div>

    <div class="split-metrics">
      <div class="summary-box compact-box">
        <strong>容量拆分</strong>
        <p>本地总大小：{{ formatBytes(localBytes) }}</p>
        <p>远端总大小：{{ formatBytes(remoteBytes) }}</p>
        <p>当前筛选大小：{{ formatBytes(visibleBytes) }}</p>
      </div>

      <div class="summary-box compact-box">
        <strong>体积分布</strong>
        <div class="size-bucket-list">
          <div v-for="bucket in sizeBuckets" :key="bucket.label" class="size-bucket-row">
            <span>{{ bucket.label }}</span>
            <span>{{ bucket.count }} 个 · {{ formatBytes(bucket.bytes) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="mini-chart">
      <div class="mini-chart-header">
        <span>最近 7 天上传流量</span>
      </div>
      <div v-if="!recentMetrics.length" class="empty-inline">暂无统计数据</div>
      <div v-else class="bar-list">
        <div v-for="item in recentMetrics" :key="item.date" class="bar-row">
          <span class="bar-label">{{ item.date.slice(5) }}</span>
          <div class="bar-track">
            <div class="bar-fill" :style="{ width: `${((item.uploadBytes || 0) / maxUpload) * 100}%` }"></div>
          </div>
          <span class="bar-value">{{ formatBytes(item.uploadBytes || 0) }}</span>
        </div>
      </div>
    </div>

    <div class="mini-chart">
      <div class="mini-chart-header">
        <span>最大文件 Top 5</span>
      </div>
      <div v-if="!largestEntries.length" class="empty-inline">暂无文件</div>
      <div v-else class="top-file-list">
        <div v-for="item in largestEntries" :key="item.id" class="top-file-row">
          <div>
            <strong>{{ item.name }}</strong>
            <p class="muted mono">{{ item.relativePath }}</p>
          </div>
          <span class="pill pill-muted">{{ formatBytes(item.size || 0) }}</span>
        </div>
      </div>
    </div>

    <div v-if="lastSyncSummary" class="summary-box">
      <strong>最近一次同步</strong>
      <p>时间：{{ formatDateTime(lastSyncSummary.finishedAt) }}</p>
      <p>成功：{{ lastSyncSummary.success }}，失败：{{ lastSyncSummary.fail }}</p>
      <p>上传：{{ formatBytes(lastSyncSummary.uploadBytes) }}，耗时：{{ Math.round(lastSyncSummary.durationMs / 1000) }} 秒</p>
    </div>
  </section>
</template>
