<script setup>
defineProps({
  logs: { type: Array, required: true },
  formatDateTime: { type: Function, required: true },
});

const emit = defineEmits(['clear']);
</script>

<template>
  <section class="card log-card">
    <div class="section-title-row">
      <div>
        <h2>运行日志</h2>
        <p class="muted">最近 200 条本地日志</p>
      </div>
      <button class="text-button" @click="emit('clear')">清空</button>
    </div>

    <div v-if="!logs.length" class="empty-state">暂无日志</div>

    <ul v-else class="log-list">
      <li v-for="item in logs" :key="item.id" class="log-item">
        <div class="log-head">
          <span class="pill" :class="item.level === 'error' ? 'pill-danger' : item.level === 'warn' ? 'pill-warning' : 'pill-muted'">
            {{ item.level }}
          </span>
          <span class="muted">{{ formatDateTime(item.time) }}</span>
        </div>
        <strong>{{ item.message }}</strong>
        <p class="muted">{{ item.detail || '-' }}</p>
      </li>
    </ul>
  </section>
</template>
