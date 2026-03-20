<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import RepoConfigPanel from './components/RepoConfigPanel.vue';
import DirectoryTree from './components/DirectoryTree.vue';
import FileTable from './components/FileTable.vue';
import PreviewPane from './components/PreviewPane.vue';
import StatsPanel from './components/StatsPanel.vue';
import LogPanel from './components/LogPanel.vue';
import { basename, dirname, getFolderStats, normalizePath } from './lib/path';
import { useAppStore } from './store/appStore';

const UI_STATE_KEY = 'gitnovelbox.ui-state';

function loadUiState() {
  try {
    const raw = localStorage.getItem(UI_STATE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      navSection: parsed.navSection || 'all',
      favoritePaths: Array.isArray(parsed.favoritePaths) ? parsed.favoritePaths : [],
      recentItems: Array.isArray(parsed.recentItems) ? parsed.recentItems : [],
      trashRecords: Array.isArray(parsed.trashRecords) ? parsed.trashRecords : [],
      selectedIds: Array.isArray(parsed.selectedIds) ? parsed.selectedIds : [],
      drawerOpen: parsed.drawerOpen ?? true,
    };
  } catch (error) {
    return {
      navSection: 'all',
      favoritePaths: [],
      recentItems: [],
      trashRecords: [],
      selectedIds: [],
      drawerOpen: true,
    };
  }
}

function saveUiState(ui) {
  localStorage.setItem(
    UI_STATE_KEY,
    JSON.stringify({
      navSection: ui.navSection,
      favoritePaths: ui.favoritePaths,
      recentItems: ui.recentItems.slice(0, 24),
      trashRecords: ui.trashRecords.slice(0, 100),
      selectedIds: ui.selectedIds,
      drawerOpen: ui.drawerOpen,
    }),
  );
}

const store = useAppStore();
const fileInputRef = ref(null);
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  title: '',
  items: [],
});
const userMenuOpen = ref(false);
const dropActive = ref(false);
const uiState = reactive(loadUiState());

watch(
  uiState,
  () => {
    saveUiState(uiState);
  },
  { deep: true },
);

const navItems = computed(() => {
  const all = store.mergedEntries.value;
  const recentSet = new Set(uiState.recentItems.map((item) => item.path));
  const favoriteSet = new Set(uiState.favoritePaths);
  return [
    { key: 'all', icon: '🗂️', label: '全部文件', count: all.length },
    { key: 'recent', icon: '🕘', label: '最近', count: uiState.recentItems.length },
    { key: 'favorites', icon: '⭐', label: '收藏', count: uiState.favoritePaths.length },
    { key: 'remote', icon: '☁️', label: '远端', count: all.filter((item) => item.remote).length },
    { key: 'local', icon: '💻', label: '本地', count: all.filter((item) => item.local).length },
    { key: 'recycle', icon: '🗑️', label: '回收区', count: uiState.trashRecords.length },
    { key: 'favorites-folder', hidden: true, count: [...favoriteSet].length },
    { key: 'recent-folder', hidden: true, count: [...recentSet].length },
  ].filter((item) => !item.hidden);
});

const breadcrumbs = computed(() => {
  const current = store.state.selectedFolder || '';
  const parts = current ? current.split('/') : [];
  const items = [{ label: '全部文件', path: '' }];
  let path = '';
  for (const part of parts) {
    path = path ? `${path}/${part}` : part;
    items.push({ label: part, path });
  }
  return items;
});

const favoriteSet = computed(() => new Set(uiState.favoritePaths));
const recentSet = computed(() => new Set(uiState.recentItems.map((item) => item.path)));

const selectedItemId = computed(() => {
  if (store.state.selectedItem.type === 'file') return store.state.selectedEntryId;
  if (store.state.selectedItem.type === 'folder') return `folder:${store.state.selectedItem.path || ''}`;
  return '';
});

const headerSummary = computed(() => {
  if (uiState.navSection === 'recycle') {
    return {
      title: '回收区',
      description: '这里显示通过网页删除远端文件后的记录，便于你回顾刚才删掉了什么。',
    };
  }
  if (uiState.navSection === 'favorites') {
    return {
      title: '收藏',
      description: '收藏文件和文件夹会固定在这里，方便快速回到常看的目录。',
    };
  }
  if (uiState.navSection === 'recent') {
    return {
      title: '最近',
      description: '最近访问的文件和文件夹会显示在这里。',
    };
  }
  if (uiState.navSection === 'remote') {
    return {
      title: '远端文件',
      description: '仅看存在于 GitHub 仓库中的内容，可用于检查远端备份覆盖情况。',
    };
  }
  if (uiState.navSection === 'local') {
    return {
      title: '本地文件',
      description: '仅看当前浏览器导入的本地 TXT 文件，适合整理待上传项目。',
    };
  }
  return {
    title: breadcrumbs.value.at(-1)?.label || '全部文件',
    description: '文件夹优先显示，支持多选、右键菜单、拖拽导入、面包屑和列表/卡片双视图。',
  };
});

const currentFolderNode = computed(() => {
  const path = store.state.selectedFolder || '';
  const visit = (node) => {
    if (!node) return null;
    if ((node.path || '') === path) return node;
    for (const child of node.children || []) {
      const result = visit(child);
      if (result) return result;
    }
    return null;
  };
  return visit(store.directoryTree.value) || store.directoryTree.value;
});

function rememberRecent(path, type) {
  if (!path && type !== 'folder-root') return;
  const normalizedPath = normalizePath(path);
  const normalizedType = type === 'folder-root' ? 'folder' : type;
  uiState.recentItems = [
    { path: normalizedPath, type: normalizedType, visitedAt: Date.now() },
    ...uiState.recentItems.filter((item) => !(item.path === normalizedPath && item.type === normalizedType)),
  ].slice(0, 24);
}

function isFavorite(path) {
  return favoriteSet.value.has(normalizePath(path));
}

function toggleFavorite(item) {
  const path = normalizePath(item?.type === 'folder' ? item.path : item?.relativePath || '');
  if (!path) return;
  if (isFavorite(path)) {
    uiState.favoritePaths = uiState.favoritePaths.filter((value) => value !== path);
  } else {
    uiState.favoritePaths = [path, ...uiState.favoritePaths].slice(0, 60);
  }
}

function entryMatchesNavigation(entry) {
  switch (uiState.navSection) {
    case 'remote':
      return Boolean(entry.remote);
    case 'local':
      return Boolean(entry.local);
    case 'favorites':
      return isFavorite(entry.relativePath);
    case 'recent':
      return recentSet.value.has(entry.relativePath);
    case 'recycle':
      return false;
    case 'all':
    default:
      return true;
  }
}

function entryMatchesFilters(entry) {
  if (uiState.navSection === 'recycle') return false;
  if (!entryMatchesNavigation(entry)) return false;
  if (store.state.statusFilter !== '全部' && entry.status !== store.state.statusFilter) return false;

  const currentFolder = store.state.selectedFolder || '';
  const searchQuery = store.state.searchQuery.trim().toLowerCase();

  if (currentFolder) {
    const inCurrentTree = entry.folder === currentFolder || entry.relativePath.startsWith(`${currentFolder}/`);
    if (!inCurrentTree) return false;
  }

  if (!searchQuery) return true;

  const inName = entry.name.toLowerCase().includes(searchQuery);
  const inPath = entry.relativePath.toLowerCase().includes(searchQuery);
  const inStatus = entry.status.toLowerCase().includes(searchQuery);
  const inSource = `${entry.local ? '本地' : ''}${entry.remote ? '远端' : ''}`.includes(searchQuery);

  switch (store.state.searchScope) {
    case '文件名':
      return inName;
    case '路径':
      return inPath;
    case '状态':
      return inStatus || inSource;
    case '全部':
    default:
      return inName || inPath || inStatus || inSource;
  }
}

function compareItems(a, b) {
  const dir = store.state.sortDirection === 'desc' ? -1 : 1;
  const statusWeight = { 待上传: 1, 待更新: 2, 仅远端: 3, 已同步: 4, 已移除: 5, 文件夹: 0 };
  const pick = (item) => {
    switch (store.state.sortField) {
      case 'name':
        return item.name || '';
      case 'size':
        return item.size || 0;
      case 'status':
        return statusWeight[item.status] ?? 999;
      case 'updatedAt':
        return item.updatedAt || item.deletedAt || 0;
      case 'source':
        return item.sourceLabel || `${item.local ? 'L' : ''}${item.remote ? 'R' : ''}`;
      case 'path':
      default:
        return item.relativePath || item.path || '';
    }
  };

  if (a.type !== b.type) {
    const order = { folder: 0, file: 1, trash: 2 };
    return (order[a.type] - order[b.type]) || 0;
  }

  const left = pick(a);
  const right = pick(b);
  if (typeof left === 'number' && typeof right === 'number') {
    if (left === right) return String(a.relativePath || a.path).localeCompare(String(b.relativePath || b.path), 'zh-CN') * dir;
    return (left - right) * dir;
  }
  const textCompare = String(left).localeCompare(String(right), 'zh-CN', { numeric: true, sensitivity: 'base' });
  if (textCompare === 0) {
    return String(a.relativePath || a.path).localeCompare(String(b.relativePath || b.path), 'zh-CN', { numeric: true, sensitivity: 'base' }) * dir;
  }
  return textCompare * dir;
}

const visibleFiles = computed(() => {
  const searchActive = Boolean(store.state.searchQuery.trim());
  const currentFolder = store.state.selectedFolder || '';
  return store.mergedEntries.value
    .filter((entry) => {
      if (!entryMatchesFilters(entry)) return false;
      if (!searchActive && currentFolder) {
        return entry.folder === currentFolder;
      }
      if (!searchActive && !currentFolder) {
        return entry.folder === '';
      }
      return true;
    })
    .map((entry) => ({
      ...entry,
      type: 'file',
      icon: entry.remote && entry.local ? '📘' : entry.remote ? '☁️' : '💻',
      favorite: isFavorite(entry.relativePath),
      checked: uiState.selectedIds.includes(entry.id),
      sourceLabel: `${entry.local ? '本地' : ''}${entry.local && entry.remote ? ' / ' : ''}${entry.remote ? '远端' : ''}` || '-',
    }))
    .sort(compareItems);
});

const visibleFolders = computed(() => {
  if (uiState.navSection === 'recycle') return [];
  const searchActive = Boolean(store.state.searchQuery.trim());
  const query = store.state.searchQuery.trim().toLowerCase();
  const currentNode = currentFolderNode.value;
  const children = currentNode?.children || [];
  const baseEntries = store.mergedEntries.value;

  if (uiState.navSection === 'favorites' || uiState.navSection === 'recent') {
    const sourcePaths = uiState.navSection === 'favorites'
      ? uiState.favoritePaths
      : uiState.recentItems.filter((item) => item.type === 'folder').map((item) => item.path);

    return sourcePaths
      .map((path) => normalizePath(path))
      .filter(Boolean)
      .map((path) => {
        const stats = getFolderStats(baseEntries.filter(entryMatchesNavigation), path);
        return {
          id: `folder:${path}`,
          type: 'folder',
          path,
          relativePath: path,
          name: basename(path),
          status: '文件夹',
          size: stats.totalSize,
          updatedAt: stats.updatedAt,
          fileCount: stats.fileCount,
          childrenCount: stats.childrenCount,
          pendingCount: stats.pendingCount,
          remoteOnlyCount: stats.remoteOnlyCount,
          favorite: isFavorite(path),
          icon: '📁',
        };
      })
      .filter((item) => (searchActive ? `${item.name} ${item.path}`.toLowerCase().includes(query) : true))
      .sort(compareItems);
  }

  return children
    .map((child) => {
      const subtreeEntries = baseEntries.filter((entry) => entry.relativePath.startsWith(`${child.path}/`) && entryMatchesNavigation(entry));
      const stats = getFolderStats(baseEntries.filter(entryMatchesNavigation), child.path);
      return {
        id: `folder:${child.path}`,
        type: 'folder',
        path: child.path,
        relativePath: child.path,
        name: child.name,
        status: '文件夹',
        size: stats.totalSize,
        updatedAt: stats.updatedAt,
        fileCount: stats.fileCount,
        childrenCount: stats.childrenCount,
        pendingCount: stats.pendingCount,
        remoteOnlyCount: stats.remoteOnlyCount,
        favorite: isFavorite(child.path),
        icon: '📁',
        hiddenBecauseEmpty: subtreeEntries.length === 0,
      };
    })
    .filter((item) => !item.hiddenBecauseEmpty || !store.state.selectedFolder)
    .filter((item) => (searchActive ? `${item.name} ${item.path}`.toLowerCase().includes(query) : true))
    .sort(compareItems);
});

const recycleItems = computed(() => {
  const query = store.state.searchQuery.trim().toLowerCase();
  return [...uiState.trashRecords]
    .filter((item) => {
      if (!query) return true;
      return `${item.name} ${item.path}`.toLowerCase().includes(query);
    })
    .map((item) => ({
      ...item,
      id: `trash:${item.path}:${item.deletedAt}`,
      type: 'trash',
      relativePath: item.path,
      status: '已移除',
      icon: '🗑️',
      favorite: false,
    }))
    .sort(compareItems);
});

const explorerItems = computed(() => {
  if (uiState.navSection === 'recycle') return recycleItems.value;
  return [...visibleFolders.value, ...visibleFiles.value].sort(compareItems);
});

const visibleMetricsEntries = computed(() => {
  if (uiState.navSection === 'recycle') return [];
  return visibleFiles.value;
});

const selectedEntries = computed(() => store.mergedEntries.value.filter((entry) => uiState.selectedIds.includes(entry.id)));

function closeContextMenu() {
  contextMenu.value.visible = false;
}

function showContextMenu({ x, y, title, items }) {
  contextMenu.value = { visible: true, x, y, title, items };
}

function openInspector() {
  uiState.drawerOpen = true;
}

function closeInspector() {
  uiState.drawerOpen = false;
}

function inspectFolder(path) {
  const normalized = normalizePath(path);
  store.state.selectedEntryId = '';
  store.state.selectedItem = { type: 'folder', path: normalized };
  rememberRecent(normalized, normalized ? 'folder' : 'folder-root');
  openInspector();
}

function navigateFolder(path) {
  const normalized = normalizePath(path);
  store.selectFolder(normalized);
  inspectFolder(normalized);
}

function selectItem(item) {
  if (!item) return;
  if (item.type === 'folder') {
    inspectFolder(item.path);
    return;
  }
  if (item.type === 'file') {
    store.selectEntry(item);
    rememberRecent(item.relativePath, 'file');
    openInspector();
    return;
  }
  store.state.selectedEntryId = '';
  store.state.selectedItem = { type: 'folder', path: '' };
  openInspector();
}

async function openItem(item) {
  if (!item) return;
  if (item.type === 'folder') {
    navigateFolder(item.path);
    return;
  }
  if (item.type === 'file') {
    await withCatch(() => store.previewEntry(item));
    return;
  }
}

function toggleSelection(item) {
  if (!item || item.type !== 'file') return;
  if (uiState.selectedIds.includes(item.id)) {
    uiState.selectedIds = uiState.selectedIds.filter((id) => id !== item.id);
  } else {
    uiState.selectedIds = [...uiState.selectedIds, item.id];
  }
}

function clearSelection() {
  uiState.selectedIds = [];
}

async function syncSelected() {
  const targets = selectedEntries.value.filter((entry) => ['待上传', '待更新'].includes(entry.status));
  if (!targets.length) {
    alert('当前选中的项目里没有需要上传或更新的文件。');
    return;
  }
  for (const entry of targets) {
    await withCatch(() => store.syncEntry(entry, { allowDelete: false }));
  }
}

async function withCatch(task) {
  try {
    await task();
  } catch (error) {
    alert(error.message || String(error));
  }
}

function openFileInput() {
  fileInputRef.value?.click();
}

async function handleDirectoryChoice() {
  if (store.directoryPickerSupported) {
    await withCatch(() => store.chooseLocalDirectory());
  } else {
    openFileInput();
  }
}

async function handleInputChange(event) {
  const files = event.target.files;
  if (!files?.length) return;
  await withCatch(() => store.loadLocalFromInput(files));
  event.target.value = '';
}

async function handleDrop(event) {
  event.preventDefault();
  dropActive.value = false;
  const files = event.dataTransfer?.files;
  if (!files?.length) return;
  await withCatch(() => store.loadLocalFromInput(files));
}

function onDragEnter(event) {
  event.preventDefault();
  dropActive.value = true;
}

function onDragOver(event) {
  event.preventDefault();
  dropActive.value = true;
}

function onDragLeave(event) {
  if (event.currentTarget === event.target) {
    dropActive.value = false;
  }
}

async function handleSingleSync(entry) {
  await withCatch(() => store.syncEntry(entry, { allowDelete: false }));
}

async function handleDeleteRemote(entry) {
  const confirmed = window.confirm(`确认删除远端文件：${entry.relativePath} ？`);
  if (!confirmed) return;
  uiState.trashRecords = [
    {
      name: entry.name,
      path: entry.relativePath,
      size: entry.size || 0,
      deletedAt: Date.now(),
      sourceLabel: entry.sourceLabel,
    },
    ...uiState.trashRecords.filter((item) => item.path !== entry.relativePath),
  ].slice(0, 100);
  await withCatch(() => store.syncEntry(entry, { allowDelete: true }));
}

async function handleContextItem(item) {
  closeContextMenu();
  if (item?.disabled || typeof item?.action !== 'function') return;
  await withCatch(item.action);
}

function promptCreateFolder(basePath = '') {
  const hint = basePath ? `在 ${basePath} 下创建新文件夹` : '在根目录创建新文件夹';
  const name = window.prompt(`${hint}\n请输入文件夹名称：`, '新建文件夹');
  if (!name) return;
  return store.createFolder(basePath, name);
}

function promptRenameFolder(folderPath) {
  const currentName = basename(folderPath);
  const name = window.prompt(`重命名文件夹：${folderPath}\n请输入新名称：`, currentName || '新文件夹');
  if (!name || name === currentName) return Promise.resolve();
  return store.renameFolder(folderPath, name);
}

function handleTreeContextMenu({ event, node }) {
  const folderPath = node.path || '';
  inspectFolder(folderPath);
  showContextMenu({
    x: event.clientX,
    y: event.clientY,
    title: folderPath || '全部文件',
    items: [
      { label: '打开文件夹', action: () => Promise.resolve(navigateFolder(folderPath)) },
      { label: '查看属性', action: () => Promise.resolve(inspectFolder(folderPath)) },
      { label: isFavorite(folderPath) ? '取消收藏' : '加入收藏', action: () => Promise.resolve(toggleFavorite({ type: 'folder', path: folderPath })) },
      { label: folderPath ? '在此处创建子文件夹' : '在根目录创建文件夹', action: () => promptCreateFolder(folderPath) },
      { label: '重命名文件夹', disabled: !folderPath, action: () => promptRenameFolder(folderPath) },
    ],
  });
}

function handleItemContextMenu({ event, item }) {
  selectItem(item);
  if (item.type === 'folder') {
    showContextMenu({
      x: event.clientX,
      y: event.clientY,
      title: item.name,
      items: [
        { label: '打开文件夹', action: () => Promise.resolve(navigateFolder(item.path)) },
        { label: '查看属性', action: () => Promise.resolve(inspectFolder(item.path)) },
        { label: isFavorite(item.path) ? '取消收藏' : '加入收藏', action: () => Promise.resolve(toggleFavorite(item)) },
        { label: '新建子文件夹', action: () => promptCreateFolder(item.path) },
        { label: '重命名文件夹', action: () => promptRenameFolder(item.path) },
      ],
    });
    return;
  }

  if (item.type === 'trash') {
    showContextMenu({
      x: event.clientX,
      y: event.clientY,
      title: item.name,
      items: [
        {
          label: '从回收区移除记录',
          action: () => Promise.resolve((uiState.trashRecords = uiState.trashRecords.filter((record) => record.path !== item.path))),
        },
      ],
    });
    return;
  }

  showContextMenu({
    x: event.clientX,
    y: event.clientY,
    title: item.name,
    items: [
      { label: '查看属性', action: () => Promise.resolve(store.selectEntry(item)) },
      { label: isFavorite(item.relativePath) ? '取消收藏' : '加入收藏', action: () => Promise.resolve(toggleFavorite(item)) },
      { label: '预览文件', action: () => store.previewEntry(item) },
      { label: '同步到 GitHub', disabled: !['待上传', '待更新'].includes(item.status), action: () => handleSingleSync(item) },
      { label: '下载远端副本', disabled: !item.remote, action: () => store.downloadRemote(item) },
      { label: '删除远端文件', danger: true, disabled: !(item.remote && !item.local), action: () => handleDeleteRemote(item) },
    ],
  });
}

function handleNavSelect(section) {
  uiState.navSection = section;
  clearSelection();
  if (['recent', 'favorites', 'recycle'].includes(section)) {
    store.selectFolder('');
    inspectFolder('');
  }
}

function handleGlobalKey(event) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    document.querySelector('.global-search-input')?.focus();
  }
  if (event.key === 'Escape') {
    closeContextMenu();
    userMenuOpen.value = false;
  }
}

onMounted(() => {
  store.bootstrap();
  inspectFolder('');
  window.addEventListener('click', closeContextMenu);
  window.addEventListener('scroll', closeContextMenu, true);
  window.addEventListener('resize', closeContextMenu);
  window.addEventListener('keydown', handleGlobalKey);
});

onBeforeUnmount(() => {
  window.removeEventListener('click', closeContextMenu);
  window.removeEventListener('scroll', closeContextMenu, true);
  window.removeEventListener('resize', closeContextMenu);
  window.removeEventListener('keydown', handleGlobalKey);
});
</script>

<template>
  <div class="app-shell app-drive-shell" @contextmenu.self.prevent>
    <input ref="fileInputRef" class="hidden-input" type="file" multiple webkitdirectory @change="handleInputChange" />

    <header class="topbar">
      <div class="brand-block">
        <div class="brand-logo">GN</div>
        <div class="brand-copy">
          <strong>GitNovelBox</strong>
          <span>GitHub 私有小说网盘</span>
        </div>
      </div>

      <div class="global-search-shell">
        <span class="global-search-icon">⌘K</span>
        <input v-model.trim="store.state.searchQuery" class="global-search-input" type="search" placeholder="全局搜索：书名、路径、状态、本地/远端" />
      </div>

      <div class="topbar-right">
        <div class="repo-status-pill" :class="store.state.connection.ok ? 'is-ok' : 'is-waiting'">
          <span class="status-dot"></span>
          <span>{{ store.state.settings.owner || '未配置' }}/{{ store.state.settings.repo || 'repo' }}</span>
          <strong>{{ store.state.connection.ok ? '已连接' : '待校验' }}</strong>
        </div>

        <button class="user-menu-button" @click.stop="userMenuOpen = !userMenuOpen">
          <span class="avatar-badge">{{ (store.state.settings.owner || 'G').slice(0, 1).toUpperCase() }}</span>
          <span class="user-menu-text">用户菜单</span>
        </button>

        <div v-if="userMenuOpen" class="user-menu" @click.stop>
          <button @click="withCatch(() => store.validateRepo())">重新校验仓库</button>
          <button @click="withCatch(() => store.loadRemoteTree())">刷新远端树</button>
          <button @click="store.clearLogs()">清空日志</button>
          <button @click="uiState.drawerOpen = !uiState.drawerOpen">{{ uiState.drawerOpen ? '收起属性抽屉' : '打开属性抽屉' }}</button>
        </div>
      </div>
    </header>

    <main class="drive-layout">
      <aside class="drive-sidebar">
        <section class="card nav-card">
          <div class="section-head compact-head">
            <div>
              <h2>网盘导航</h2>
              <p class="muted">切换不同视图和工作区</p>
            </div>
          </div>

          <nav class="drive-nav-list">
            <button
              v-for="item in navItems"
              :key="item.key"
              class="drive-nav-item"
              :class="{ active: uiState.navSection === item.key }"
              @click="handleNavSelect(item.key)"
            >
              <span class="drive-nav-icon">{{ item.icon }}</span>
              <span class="drive-nav-label">{{ item.label }}</span>
              <span class="drive-nav-count">{{ item.count }}</span>
            </button>
          </nav>
        </section>

        <DirectoryTree
          :tree="store.directoryTree.value"
          :selected-folder="store.state.selectedFolder"
          @select="navigateFolder"
          @contextmenu="handleTreeContextMenu"
        />

        <RepoConfigPanel
          :settings="store.state.settings"
          :connection="store.state.connection"
          :busy="store.state.busy"
          :directory-picker-supported="store.directoryPickerSupported"
          @save="store.persistSettings"
          @validate="() => withCatch(() => store.validateRepo())"
        />

        <StatsPanel
          :entries="store.mergedEntries.value"
          :visible-entries="visibleMetricsEntries"
          :metrics-history="store.state.metricsHistory"
          :pending-count="store.pendingCount.value"
          :remote-only-count="store.remoteOnlyCount.value"
          :last-sync-summary="store.state.lastSyncSummary"
          :format-bytes="store.formatBytes"
          :format-date-time="store.formatDateTime"
        />
      </aside>

      <section class="drive-main">
        <section class="card workspace-hero">
          <div>
            <p class="eyebrow">资源管理器</p>
            <h1>{{ headerSummary.title }}</h1>
            <p class="muted workspace-text">{{ headerSummary.description }}</p>
          </div>
          <div class="workspace-highlights">
            <span class="pill pill-muted">v{{ __APP_VERSION__ }}</span>
            <span class="pill pill-accent">当前视图 {{ explorerItems.length }} 项</span>
            <span class="pill pill-muted">可见文件 {{ visibleMetricsEntries.length }} 个</span>
            <span class="pill pill-muted">可见大小 {{ store.formatBytes(visibleMetricsEntries.reduce((sum, entry) => sum + (entry.size || 0), 0)) }}</span>
          </div>
        </section>

        <section
          class="card explorer-toolbar-card"
          :class="{ 'drop-active': dropActive }"
          @dragenter="onDragEnter"
          @dragover="onDragOver"
          @dragleave="onDragLeave"
          @drop="handleDrop"
        >
          <div class="toolbar-row top-actions-row">
            <div class="toolbar-actions-group">
              <button class="button button-primary" :disabled="store.state.busy" @click="handleDirectoryChoice">选择本地目录</button>
              <button class="button" :disabled="store.state.busy || !store.state.localHandle" @click="() => withCatch(() => store.rescanLocalDirectory())">重新扫描</button>
              <button class="button" :disabled="store.state.busy" @click="() => withCatch(() => store.loadRemoteTree())">刷新远端</button>
              <button class="button button-success" :disabled="store.state.busy" @click="() => withCatch(() => store.syncAll())">一键同步</button>
              <button class="button" :disabled="!uiState.selectedIds.length" @click="syncSelected">同步选中 {{ uiState.selectedIds.length }}</button>
              <button class="button ghost-button" :disabled="!uiState.selectedIds.length" @click="clearSelection">清空勾选</button>
            </div>
            <div class="toolbar-actions-group right-group">
              <button class="view-mode-button" :class="{ active: store.state.viewMode === 'list' }" @click="store.state.viewMode = 'list'">列表</button>
              <button class="view-mode-button" :class="{ active: store.state.viewMode === 'cards' }" @click="store.state.viewMode = 'cards'">卡片</button>
            </div>
          </div>

          <div class="toolbar-row filter-row">
            <div class="control-stack grow">
              <label class="field-label">当前位置</label>
              <div class="breadcrumb-bar">
                <button
                  v-for="crumb in breadcrumbs"
                  :key="crumb.path || 'root'"
                  class="breadcrumb-button"
                  @click="navigateFolder(crumb.path)"
                >
                  {{ crumb.label }}
                </button>
              </div>
            </div>
          </div>

          <div class="toolbar-row filter-row grid-controls-row">
            <div class="control-stack">
              <label class="field-label">搜索范围</label>
              <select v-model="store.state.searchScope" class="select-input">
                <option>全部</option>
                <option>文件名</option>
                <option>路径</option>
                <option>状态</option>
              </select>
            </div>
            <div class="control-stack">
              <label class="field-label">状态筛选</label>
              <select v-model="store.state.statusFilter" class="select-input">
                <option>全部</option>
                <option>已同步</option>
                <option>待上传</option>
                <option>待更新</option>
                <option>仅远端</option>
              </select>
            </div>
            <div class="control-stack">
              <label class="field-label">排序字段</label>
              <select v-model="store.state.sortField" class="select-input">
                <option value="path">路径</option>
                <option value="name">文件名</option>
                <option value="size">大小</option>
                <option value="status">状态</option>
                <option value="updatedAt">更新时间</option>
                <option value="source">来源</option>
              </select>
            </div>
            <div class="control-stack">
              <label class="field-label">排序顺序</label>
              <select v-model="store.state.sortDirection" class="select-input">
                <option value="asc">升序</option>
                <option value="desc">降序</option>
              </select>
            </div>
            <div class="control-stack fit-content">
              <label class="field-label">拖拽上传</label>
              <div class="drop-hint-box">拖入 txt 或文件夹到此区域</div>
            </div>
          </div>

          <div class="summary-row">
            <span class="summary-chip">本地目录：{{ store.state.localSourceLabel }}</span>
            <span class="summary-chip">待同步 {{ store.pendingCount.value }}</span>
            <span class="summary-chip">仅远端 {{ store.remoteOnlyCount.value }}</span>
            <span class="summary-chip">收藏 {{ uiState.favoritePaths.length }}</span>
            <span class="summary-chip">最近 {{ uiState.recentItems.length }}</span>
            <span class="summary-chip busy-chip" :class="{ active: store.state.busy }">{{ store.state.busy ? store.state.busyLabel || '处理中...' : '空闲' }}</span>
          </div>
        </section>

        <FileTable
          :items="explorerItems"
          :selected-item-id="selectedItemId"
          :selected-ids="uiState.selectedIds"
          :busy="store.state.busy"
          :view-mode="store.state.viewMode"
          :format-bytes="store.formatBytes"
          :format-date-time="store.formatDateTime"
          @select="selectItem"
          @open="openItem"
          @toggle-check="toggleSelection"
          @preview="(entry) => withCatch(() => store.previewEntry(entry))"
          @sync="handleSingleSync"
          @download="(entry) => withCatch(() => store.downloadRemote(entry))"
          @delete-remote="handleDeleteRemote"
          @contextmenu="handleItemContextMenu"
          @favorite="toggleFavorite"
        />

        <LogPanel :logs="store.state.logs" :format-date-time="store.formatDateTime" @clear="store.clearLogs" />
      </section>
    </main>

    <transition name="drawer-slide">
      <aside v-if="uiState.drawerOpen" class="inspector-drawer" @click.stop>
        <div class="drawer-header">
          <div>
            <p class="eyebrow">属性抽屉</p>
            <h2>文件 / 文件夹属性</h2>
          </div>
          <div class="drawer-head-actions">
            <button
              class="icon-button"
              :disabled="!store.state.selectedItem.path && !store.state.selectedEntryId"
              @click="toggleFavorite(store.state.selectedItem.type === 'file' ? store.selectedEntry.value : store.state.selectedItem)"
            >
              {{ isFavorite(store.state.selectedItem.type === 'file' ? store.state.selectedItem.path : store.state.selectedItem.path) ? '★' : '☆' }}
            </button>
            <button class="icon-button" @click="closeInspector">✕</button>
          </div>
        </div>

        <PreviewPane
          :inspector="store.selectedInspector.value"
          :preview="store.state.preview"
          :format-bytes="store.formatBytes"
          :format-date-time="store.formatDateTime"
          @preview-local="() => withCatch(() => store.previewEntry(store.selectedEntry.value, 'local'))"
          @preview-remote="() => withCatch(() => store.previewEntry(store.selectedEntry.value, 'remote'))"
          @download="() => withCatch(() => store.downloadRemote(store.selectedEntry.value))"
          @navigate-folder="navigateFolder"
        />
      </aside>
    </transition>

    <footer class="drive-footer">
      <span>{{ store.state.settings.owner || '-' }}/{{ store.state.settings.repo || '-' }} @ {{ store.state.settings.branch || '-' }}</span>
      <span>前缀：{{ store.state.settings.repoPrefix || 'books' }}</span>
      <span>本地 {{ store.state.localFiles.length }} 项</span>
      <span>远端 {{ store.state.remoteFiles.length }} 项</span>
      <span>{{ store.state.viewMode === 'cards' ? '卡片视图' : '列表视图' }}</span>
    </footer>

    <teleport to="body">
      <div v-if="contextMenu.visible" class="context-menu" :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }" @click.stop>
        <div class="context-menu-title">{{ contextMenu.title }}</div>
        <button
          v-for="item in contextMenu.items"
          :key="item.label"
          class="context-menu-item"
          :class="{ danger: item.danger }"
          :disabled="item.disabled"
          @click="handleContextItem(item)"
        >
          {{ item.label }}
        </button>
      </div>
    </teleport>
  </div>
</template>
