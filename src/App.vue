<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import AppIcon from './components/AppIcon.vue';
import RepoConfigPanel from './components/RepoConfigPanel.vue';
import DirectoryTree from './components/DirectoryTree.vue';
import FileTable from './components/FileTable.vue';
import PreviewPane from './components/PreviewPane.vue';
import StatsPanel from './components/StatsPanel.vue';
import LogPanel from './components/LogPanel.vue';
import { basename, getFolderStats, normalizePath } from './lib/path';
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
      sidebarCollapsed: parsed.sidebarCollapsed ?? false,
      settingsOpen: parsed.settingsOpen ?? false,
      activeSettingsTab: parsed.activeSettingsTab || 'repo',
    };
  } catch {
    return {
      navSection: 'all',
      favoritePaths: [],
      recentItems: [],
      trashRecords: [],
      selectedIds: [],
      drawerOpen: true,
      sidebarCollapsed: false,
      settingsOpen: false,
      activeSettingsTab: 'repo',
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
      sidebarCollapsed: ui.sidebarCollapsed,
      settingsOpen: ui.settingsOpen,
      activeSettingsTab: ui.activeSettingsTab,
    }),
  );
}

const store = useAppStore();
const fileInputRef = ref(null);
const contextMenu = ref({ visible: false, x: 0, y: 0, title: '', items: [] });
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
  return [
    { key: 'all', icon: 'all', label: '全部文件', count: all.length },
    { key: 'recent', icon: 'recent', label: '最近', count: uiState.recentItems.length },
    { key: 'favorites', icon: 'favorites', label: '收藏', count: uiState.favoritePaths.length },
    { key: 'remote', icon: 'remote', label: '远端', count: all.filter((item) => item.remote).length },
    { key: 'local', icon: 'local', label: '本地', count: all.filter((item) => item.local).length },
    { key: 'recycle', icon: 'recycle', label: '回收区', count: uiState.trashRecords.length },
  ];
});

const settingsTabs = [
  { key: 'repo', label: '连接与同步' },
  { key: 'stats', label: '统计' },
  { key: 'logs', label: '日志' },
];

const favoriteSet = computed(() => new Set(uiState.favoritePaths));
const recentSet = computed(() => new Set(uiState.recentItems.map((item) => item.path)));

const selectedItemId = computed(() => {
  if (store.state.selectedItem.type === 'file') return store.state.selectedEntryId;
  if (store.state.selectedItem.type === 'folder') return `folder:${store.state.selectedItem.path || ''}`;
  return '';
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

const headerSummary = computed(() => {
  switch (uiState.navSection) {
    case 'recycle':
      return { title: '回收区', description: '这里只保留删除远端时留下的记录。' };
    case 'favorites':
      return { title: '收藏', description: '常用目录和文件会固定在这里。' };
    case 'recent':
      return { title: '最近', description: '最近打开过的目录和文件。' };
    case 'remote':
      return { title: '远端文件', description: '只显示 GitHub 仓库中的内容。' };
    case 'local':
      return { title: '本地文件', description: '只显示当前浏览器已读入的本地 TXT。' };
    default:
      return {
        title: breadcrumbs.value.at(-1)?.label || '全部文件',
        description: '主区按云盘文件区布局保留目录、工具栏、文件表格和右侧详情。',
      };
  }
});

const workspaceCards = computed(() => {
  const currentFolderName = breadcrumbs.value.at(-1)?.label || '全部文件';
  return [
    { label: '全部文件', value: String(store.mergedEntries.value.length), hint: '当前仓库 + 本地合并后条目' },
    { label: '待同步', value: String(store.pendingCount.value), hint: '待上传 / 待更新' },
    { label: '仅远端', value: String(store.remoteOnlyCount.value), hint: '仓库存在，本地未读入' },
    { label: '当前目录', value: currentFolderName, hint: store.state.selectedFolder || '/' },
  ];
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
  const path = normalizePath(item?.type === 'folder' ? item.path : item?.relativePath || item?.path || '');
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
      if (!searchActive && currentFolder) return entry.folder === currentFolder;
      if (!searchActive && !currentFolder) return entry.folder === '';
      return true;
    })
    .map((entry) => ({
      ...entry,
      type: 'file',
      icon: entry.remote && entry.local ? 'file-sync' : entry.remote ? 'file-remote' : 'file-local',
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
          icon: 'folder',
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
        icon: 'folder',
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
    .filter((item) => (!query ? true : `${item.name} ${item.path}`.toLowerCase().includes(query)))
    .map((item) => ({
      ...item,
      id: `trash:${item.path}:${item.deletedAt}`,
      type: 'trash',
      relativePath: item.path,
      status: '已移除',
      icon: 'recycle',
      favorite: false,
    }))
    .sort(compareItems);
});

const explorerItems = computed(() => (uiState.navSection === 'recycle' ? recycleItems.value : [...visibleFolders.value, ...visibleFiles.value].sort(compareItems)));
const visibleMetricsEntries = computed(() => (uiState.navSection === 'recycle' ? [] : visibleFiles.value));
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

function openSettings(tab = uiState.activeSettingsTab) {
  uiState.activeSettingsTab = tab;
  uiState.settingsOpen = true;
  userMenuOpen.value = false;
}

function closeSettings() {
  uiState.settingsOpen = false;
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
  }
}

function toggleSelection(item) {
  if (!item || item.type !== 'file') return;
  if (uiState.selectedIds.includes(item.id)) uiState.selectedIds = uiState.selectedIds.filter((id) => id !== item.id);
  else uiState.selectedIds = [...uiState.selectedIds, item.id];
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
  for (const entry of targets) await withCatch(() => store.syncEntry(entry, { allowDelete: false }));
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
  if (store.directoryPickerSupported) await withCatch(() => store.chooseLocalDirectory());
  else openFileInput();
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
  if (event.currentTarget === event.target) dropActive.value = false;
}

async function handleSingleSync(entry) {
  await withCatch(() => store.syncEntry(entry, { allowDelete: false }));
}

async function handleDeleteRemote(entry) {
  const confirmed = window.confirm(`确认删除远端文件：${entry.relativePath} ？`);
  if (!confirmed) return;
  uiState.trashRecords = [
    { name: entry.name, path: entry.relativePath, size: entry.size || 0, deletedAt: Date.now(), sourceLabel: entry.sourceLabel },
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
      items: [{ label: '从回收区移除记录', action: () => Promise.resolve((uiState.trashRecords = uiState.trashRecords.filter((record) => record.path !== item.path))) }],
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
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === ',') {
    event.preventDefault();
    openSettings('repo');
  }
  if (event.key === 'Escape') {
    closeContextMenu();
    userMenuOpen.value = false;
    if (uiState.settingsOpen) closeSettings();
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
  <div class="app-shell cloud-shell" @contextmenu.self.prevent>
    <input ref="fileInputRef" class="hidden-input" type="file" multiple webkitdirectory @change="handleInputChange" />

    <header class="topbar">
      <div class="brand-block">
        <button class="sidebar-toggle" @click="uiState.sidebarCollapsed = !uiState.sidebarCollapsed">
          <AppIcon :name="uiState.sidebarCollapsed ? 'menu' : 'close'" :size="16" />
        </button>
        <div class="brand-logo">G</div>
        <div class="brand-copy">
          <strong>GitNovelBox</strong>
          <span>TXT 云盘工作区</span>
        </div>
      </div>

      <div class="global-search-shell">
        <span class="global-search-icon"><AppIcon name="search" :size="15" /></span>
        <input v-model.trim="store.state.searchQuery" class="global-search-input" type="search" placeholder="搜索文件名、路径、状态、本地/远端" />
        <span class="global-search-shortcut">⌘K</span>
      </div>

      <div class="topbar-right">
        <div class="repo-status-pill" :class="store.state.connection.ok ? 'is-ok' : 'is-waiting'">
          <span class="status-dot"></span>
          <div class="repo-status-text">
            <span>{{ store.state.settings.owner || '未配置' }}/{{ store.state.settings.repo || 'repo' }}</span>
            <strong>{{ store.state.connection.ok ? '已连接' : '待校验' }}</strong>
          </div>
        </div>

        <button class="user-menu-button" @click.stop="userMenuOpen = !userMenuOpen">
          <span class="avatar-badge"><AppIcon name="settings" :size="14" /></span>
          <span class="user-menu-text">设置</span>
        </button>

        <div v-if="userMenuOpen" class="user-menu" @click.stop>
          <button @click="openSettings('repo')">连接与同步</button>
          <button @click="openSettings('stats')">统计</button>
          <button @click="openSettings('logs')">运行日志</button>
          <button @click="uiState.drawerOpen = !uiState.drawerOpen">{{ uiState.drawerOpen ? '收起详情栏' : '打开详情栏' }}</button>
        </div>
      </div>
    </header>

    <main class="drive-layout" :class="{ 'sidebar-collapsed': uiState.sidebarCollapsed, 'drawer-visible': uiState.drawerOpen }">
      <aside class="drive-sidebar" :class="{ 'is-collapsed': uiState.sidebarCollapsed }">
        <section class="card nav-card">
          <button class="button button-primary primary-sidebar-action" :disabled="store.state.busy" @click="handleDirectoryChoice">
            选择本地目录
          </button>

          <nav class="drive-nav-list">
            <button
              v-for="item in navItems"
              :key="item.key"
              class="drive-nav-item"
              :class="{ active: uiState.navSection === item.key }"
              @click="handleNavSelect(item.key)"
            >
              <span class="drive-nav-icon"><AppIcon :name="item.icon" :size="18" /></span>
              <span class="drive-nav-label">{{ item.label }}</span>
              <span class="drive-nav-count">{{ item.count }}</span>
            </button>
          </nav>
        </section>

        <DirectoryTree
          v-if="!uiState.sidebarCollapsed"
          :tree="store.directoryTree.value"
          :selected-folder="store.state.selectedFolder"
          @select="navigateFolder"
          @contextmenu="handleTreeContextMenu"
        />
      </aside>

      <section class="drive-main">
        <section class="summary-strip">
          <article v-for="card in workspaceCards" :key="card.label" class="summary-card card compact-card">
            <span class="summary-label">{{ card.label }}</span>
            <strong class="summary-value">{{ card.value }}</strong>
            <span class="summary-note">{{ card.hint }}</span>
          </article>
        </section>

        <section
          class="card explorer-toolbar-card"
          :class="{ 'drop-active': dropActive }"
          @dragenter="onDragEnter"
          @dragover="onDragOver"
          @dragleave="onDragLeave"
          @drop="handleDrop"
        >
          <div class="section-title-row toolbar-title-row">
            <div>
              <h2>{{ headerSummary.title }}</h2>
              <p class="muted">{{ headerSummary.description }}</p>
            </div>
            <div class="toolbar-title-actions">
              <button class="button" @click="openSettings('repo')">设置</button>
              <button class="button" @click="uiState.drawerOpen = !uiState.drawerOpen">{{ uiState.drawerOpen ? '收起详情' : '打开详情' }}</button>
            </div>
          </div>

          <div class="toolbar-row">
            <div class="toolbar-actions-group">
              <button class="button button-primary" :disabled="store.state.busy" @click="handleDirectoryChoice">选择本地目录</button>
              <button class="button" :disabled="store.state.busy || !store.state.localHandle" @click="() => withCatch(() => store.rescanLocalDirectory())">重新扫描</button>
              <button class="button" :disabled="store.state.busy" @click="() => withCatch(() => store.loadRemoteTree())">刷新远端</button>
              <button class="button button-success" :disabled="store.state.busy" @click="() => withCatch(() => store.syncAll())">一键同步</button>
              <button class="button" :disabled="!uiState.selectedIds.length" @click="syncSelected">同步选中 {{ uiState.selectedIds.length }}</button>
            </div>
            <div class="toolbar-actions-group right-group">
              <button class="view-mode-button" :class="{ active: store.state.viewMode === 'list' }" @click="store.state.viewMode = 'list'">列表</button>
              <button class="view-mode-button" :class="{ active: store.state.viewMode === 'cards' }" @click="store.state.viewMode = 'cards'">卡片</button>
            </div>
          </div>

          <div class="toolbar-row filter-row">
            <div class="control-stack grow">
              <label class="field-label">路径</label>
              <div class="breadcrumb-bar">
                <button v-for="crumb in breadcrumbs" :key="crumb.path || 'root'" class="breadcrumb-button" @click="navigateFolder(crumb.path)">
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
              <label class="field-label">状态</label>
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
              <label class="field-label">拖拽导入</label>
              <div class="drop-hint-box">拖入 txt 或文件夹</div>
            </div>
          </div>

          <div class="summary-row compact-summary-row">
            <span class="summary-chip">本地目录：{{ store.state.localSourceLabel }}</span>
            <span class="summary-chip">视图：{{ store.state.viewMode === 'cards' ? '卡片' : '列表' }}</span>
            <span class="summary-chip">{{ explorerItems.length }} 项</span>
            <span class="summary-chip busy-chip" :class="{ active: store.state.busy }">{{ store.state.busy ? store.state.busyLabel || '处理中…' : '空闲' }}</span>
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
      </section>
    </main>

    <transition name="drawer-slide">
      <aside v-if="uiState.drawerOpen" class="inspector-drawer" @click.stop>
        <div class="drawer-header">
          <div>
            <p class="eyebrow">详情</p>
            <h2>文件 / 文件夹属性</h2>
          </div>
          <div class="drawer-head-actions">
            <button
              class="icon-button"
              :disabled="!store.state.selectedItem.path && !store.state.selectedEntryId"
              @click="toggleFavorite(store.state.selectedItem.type === 'file' ? store.selectedEntry.value : store.state.selectedItem)"
            >
              <AppIcon :name="isFavorite(store.state.selectedItem.path) ? 'favorites' : 'dot'" :size="15" />
            </button>
            <button class="icon-button" @click="closeInspector"><AppIcon name="close" :size="15" /></button>
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

    <transition name="soft-fade">
      <div v-if="uiState.settingsOpen" class="settings-modal-shell" @click.self="closeSettings">
        <section class="settings-modal card">
          <div class="settings-modal-head">
            <div>
              <p class="eyebrow">设置</p>
              <h2>连接、统计和日志</h2>
              <p class="muted">主界面只保留文件区，配置和统计放到这里。</p>
            </div>
            <button class="icon-button" @click="closeSettings"><AppIcon name="close" :size="15" /></button>
          </div>

          <div class="settings-tabs">
            <button
              v-for="tab in settingsTabs"
              :key="tab.key"
              class="settings-tab"
              :class="{ active: uiState.activeSettingsTab === tab.key }"
              @click="uiState.activeSettingsTab = tab.key"
            >
              {{ tab.label }}
            </button>
          </div>

          <div class="settings-content">
            <RepoConfigPanel
              v-if="uiState.activeSettingsTab === 'repo'"
              :settings="store.state.settings"
              :connection="store.state.connection"
              :busy="store.state.busy"
              :directory-picker-supported="store.directoryPickerSupported"
              @save="store.persistSettings"
              @validate="() => withCatch(() => store.validateRepo())"
            />

            <StatsPanel
              v-else-if="uiState.activeSettingsTab === 'stats'"
              :entries="store.mergedEntries.value"
              :visible-entries="visibleMetricsEntries"
              :metrics-history="store.state.metricsHistory"
              :pending-count="store.pendingCount.value"
              :remote-only-count="store.remoteOnlyCount.value"
              :last-sync-summary="store.state.lastSyncSummary"
              :format-bytes="store.formatBytes"
              :format-date-time="store.formatDateTime"
            />

            <LogPanel v-else :logs="store.state.logs" :format-date-time="store.formatDateTime" @clear="store.clearLogs" />
          </div>
        </section>
      </div>
    </transition>

    <footer class="drive-footer">
      <span>{{ store.state.settings.owner || '-' }}/{{ store.state.settings.repo || '-' }}</span>
      <span>分支：{{ store.state.settings.branch || '-' }}</span>
      <span>前缀：{{ store.state.settings.repoPrefix || 'books' }}</span>
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
