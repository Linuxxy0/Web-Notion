<script setup>
defineProps({
  settings: { type: Object, required: true },
  connection: { type: Object, required: true },
  busy: { type: Boolean, default: false },
  directoryPickerSupported: { type: Boolean, default: false },
});

const emit = defineEmits(['save', 'validate']);
</script>

<template>
  <section class="card">
    <div class="section-title-row">
      <div>
        <h2>仓库配置</h2>
        <p class="muted">纯前端直连 GitHub API，不需要服务器。</p>
      </div>
      <span class="pill" :class="connection.ok ? 'pill-success' : 'pill-muted'">
        {{ connection.ok ? '已连接' : '未校验' }}
      </span>
    </div>

    <div class="form-grid">
      <label>
        <span>GitHub Token</span>
        <input v-model.trim="settings.token" type="password" placeholder="ghp_ / github_pat_..." />
      </label>
      <label>
        <span>Owner</span>
        <input v-model.trim="settings.owner" type="text" placeholder="你的 GitHub 用户名或组织名" />
      </label>
      <label>
        <span>Repo</span>
        <input v-model.trim="settings.repo" type="text" placeholder="仓库名" />
      </label>
      <label>
        <span>Branch</span>
        <input v-model.trim="settings.branch" type="text" placeholder="main" />
      </label>
      <label>
        <span>Repo Prefix</span>
        <input v-model.trim="settings.repoPrefix" type="text" placeholder="books" />
      </label>
      <label>
        <span>文件大小上限（MB）</span>
        <input v-model.number="settings.maxFileSizeMB" type="number" min="1" step="1" />
      </label>
    </div>

    <div class="toggle-row">
      <label class="checkbox">
        <input v-model="settings.rememberToken" type="checkbox" />
        <span>记住 Token 到本地浏览器</span>
      </label>
      <label class="checkbox">
        <input v-model="settings.ignoreHidden" type="checkbox" />
        <span>忽略隐藏文件 / 隐藏目录</span>
      </label>
      <label class="checkbox">
        <input v-model="settings.deleteRemoteMissing" type="checkbox" />
        <span>同步时删除“仅远端”文件</span>
      </label>
    </div>

    <div class="button-row">
      <button class="button button-primary" :disabled="busy" @click="emit('save')">保存配置</button>
      <button class="button" :disabled="busy" @click="emit('validate')">校验仓库</button>
    </div>

    <div class="info-list">
      <p><strong>连接状态：</strong>{{ connection.message }}</p>
      <p><strong>目录选择器：</strong>{{ directoryPickerSupported ? '当前浏览器支持 showDirectoryPicker' : '将使用文件夹输入回退模式' }}</p>
      <p><strong>建议权限：</strong>Fine-grained PAT，Contents: Read &amp; write，Metadata: Read</p>
    </div>
  </section>
</template>
