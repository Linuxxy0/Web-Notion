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
const sceneDefinitions = [
  {
    id: 'dawn',
    label: '清晨',
    title: '让光先落进房间，再打开目录。',
    description: '暖灰与云母白像晨间的纱帘，界面不再像一台工具，而像一个被慢慢唤醒的居所。',
    accent: '#d6b48a',
  },
  {
    id: 'noon',
    label: '正午',
    title: '所有文件都沐在温和的光里。',
    description: '搜索、筛选、拖拽上传被留在最安静的位置，像看不见的手，轻轻调整房间里的秩序。',
    accent: '#e0c7a2',
  },
  {
    id: 'dusk',
    label: '黄昏',
    title: '阅读、沐浴、睡眠，像同一束流动的光。',
    description: '分屏叙事展示三段生活，文件管理退到背景，只留下松弛与连贯的体验。',
    accent: '#c98f67',
  },
  {
    id: 'night',
    label: '深夜',
    title: '夜色收拢界面，属性像抽屉一样轻轻滑出。',
    description: '右侧抽屉接近系统资源管理器的质感，把必要信息留给你，把技术噪音藏起来。',
    accent: '#8c7f86',
  },
];

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
      techOpen: parsed.techOpen ?? false,
      timeOverride: typeof parsed.timeOverride === 'number' ? parsed.timeOverride : null,
    };
  } catch (error) {
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
      techOpen: false,
      timeOverride: null,
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
      techOpen: ui.techOpen,
      timeOverride: ui.timeOverride,
    }),
  );
}

const store = useAppStore();
const fileInputRef = ref(null);
const backgroundCanvas = ref(null);
const contextMenu = ref({ visible: false, x: 0, y: 0, title: '', items: [] });
const userMenuOpen = ref(false);
const dropActive = ref(false);
const scrollProgress = ref(0);
const ambientValues = reactive({ temperature: 24, humidity: 46, light: 72 });
const uiState = reactive(loadUiState());
let animationFrameId = 0;
let particles = [];

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

const activeSceneIndex = computed(() => {
  if (uiState.timeOverride !== null) return uiState.timeOverride;
  return Math.min(sceneDefinitions.length - 1, Math.max(0, Math.floor(scrollProgress.value * sceneDefinitions.length)));
});
const activeScene = computed(() => sceneDefinitions[activeSceneIndex.value]);
const sceneMetaCards = computed(() => [
  { label: '温度', value: `${ambientValues.temperature.toFixed(1)}°C`, hint: '随鼠标位置浮动' },
  { label: '湿度', value: `${ambientValues.humidity.toFixed(0)}%`, hint: '空气感轻轻变化' },
  { label: '光照', value: `${ambientValues.light.toFixed(0)}%`, hint: '随场景与滚动调整' },
]);
const pageStyle = computed(() => ({ '--scene-accent': activeScene.value.accent }));

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
    return { title: '回收区', description: '删掉的远端记录会暂留在这里，方便你回想刚才做过的动作。' };
  }
  if (uiState.navSection === 'favorites') {
    return { title: '收藏', description: '像把常看的那几本书放在沙发边，随手就能重新打开。' };
  }
  if (uiState.navSection === 'recent') {
    return { title: '最近', description: '保留你刚刚经过的路径，让网盘像日常动线一样自然。' };
  }
  if (uiState.navSection === 'remote') {
    return { title: '远端文件', description: '只看 GitHub 私有仓库里的内容，检查备份是否完整。' };
  }
  if (uiState.navSection === 'local') {
    return { title: '本地文件', description: '只看浏览器已读入的本地 TXT，适合整理再上传。' };
  }
  return { title: breadcrumbs.value.at(-1)?.label || '全部文件', description: '主界面只保留导航、目录与网盘内容；配置、统计、日志都藏进设置菜单。' };
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
    case 'remote': return Boolean(entry.remote);
    case 'local': return Boolean(entry.local);
    case 'favorites': return isFavorite(entry.relativePath);
    case 'recent': return recentSet.value.has(entry.relativePath);
    case 'recycle': return false;
    default: return true;
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
    case '文件名': return inName;
    case '路径': return inPath;
    case '状态': return inStatus || inSource;
    default: return inName || inPath || inStatus || inSource;
  }
}

function compareItems(a, b) {
  const dir = store.state.sortDirection === 'desc' ? -1 : 1;
  const statusWeight = { 待上传: 1, 待更新: 2, 仅远端: 3, 已同步: 4, 已移除: 5, 文件夹: 0 };
  const pick = (item) => {
    switch (store.state.sortField) {
      case 'name': return item.name || '';
      case 'size': return item.size || 0;
      case 'status': return statusWeight[item.status] ?? 999;
      case 'updatedAt': return item.updatedAt || item.deletedAt || 0;
      case 'source': return item.sourceLabel || `${item.local ? 'L' : ''}${item.remote ? 'R' : ''}`;
      default: return item.relativePath || item.path || '';
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

function closeContextMenu() { contextMenu.value.visible = false; }
function showContextMenu({ x, y, title, items }) { contextMenu.value = { visible: true, x, y, title, items }; }
function openInspector() { uiState.drawerOpen = true; }
function closeInspector() { uiState.drawerOpen = false; }
function openSettings(tab = uiState.activeSettingsTab) { uiState.activeSettingsTab = tab; uiState.settingsOpen = true; userMenuOpen.value = false; }
function closeSettings() { uiState.settingsOpen = false; }
function setScene(index) { uiState.timeOverride = index; }
function clearSceneOverride() { uiState.timeOverride = null; }

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
function clearSelection() { uiState.selectedIds = []; }

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

function openFileInput() { fileInputRef.value?.click(); }
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
function onDragEnter(event) { event.preventDefault(); dropActive.value = true; }
function onDragOver(event) { event.preventDefault(); dropActive.value = true; }
function onDragLeave(event) { if (event.currentTarget === event.target) dropActive.value = false; }
async function handleSingleSync(entry) { await withCatch(() => store.syncEntry(entry, { allowDelete: false })); }

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

function updateScrollProgress() {
  const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  scrollProgress.value = Math.min(0.999, window.scrollY / scrollable);
}

function handleAmbientMove(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  ambientValues.temperature = 21 + x * 7;
  ambientValues.humidity = 38 + (1 - y) * 28;
  ambientValues.light = 24 + (1 - y) * 60;
}

function resetAmbient() {
  ambientValues.temperature = 24;
  ambientValues.humidity = 46;
  ambientValues.light = activeSceneIndex.value === 3 ? 18 : 72 - activeSceneIndex.value * 10;
}

function resizeCanvas() {
  const canvas = backgroundCanvas.value;
  if (!canvas) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * ratio);
  canvas.height = Math.floor(window.innerHeight * ratio);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  const count = Math.max(32, Math.floor(window.innerWidth / 28));
  particles = Array.from({ length: count }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: ratio * (0.7 + Math.random() * 1.9),
    vx: ratio * (0.03 + Math.random() * 0.12),
    vy: ratio * (0.01 + Math.random() * 0.05),
    alpha: 0.08 + Math.random() * 0.18,
  }));
}

function particleColor(sceneId) {
  switch (sceneId) {
    case 'dawn': return '242, 229, 210';
    case 'noon': return '250, 240, 226';
    case 'dusk': return '235, 191, 150';
    case 'night': return '208, 196, 212';
    default: return '242, 229, 210';
  }
}

function animateCanvas() {
  const canvas = backgroundCanvas.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const rgb = particleColor(activeScene.value.id);
  for (const particle of particles) {
    particle.x += particle.vx;
    particle.y += particle.vy;
    if (particle.x > canvas.width + 12) particle.x = -12;
    if (particle.y > canvas.height + 12) particle.y = -12;
    ctx.beginPath();
    ctx.fillStyle = `rgba(${rgb}, ${particle.alpha})`;
    ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
    ctx.fill();
  }
  animationFrameId = window.requestAnimationFrame(animateCanvas);
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

watch(activeSceneIndex, () => {
  if (!dropActive.value) resetAmbient();
});

onMounted(() => {
  store.bootstrap();
  inspectFolder('');
  updateScrollProgress();
  resetAmbient();
  resizeCanvas();
  animateCanvas();
  window.addEventListener('click', closeContextMenu);
  window.addEventListener('scroll', closeContextMenu, true);
  window.addEventListener('scroll', updateScrollProgress, { passive: true });
  window.addEventListener('resize', closeContextMenu);
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('keydown', handleGlobalKey);
});

onBeforeUnmount(() => {
  window.cancelAnimationFrame(animationFrameId);
  window.removeEventListener('click', closeContextMenu);
  window.removeEventListener('scroll', closeContextMenu, true);
  window.removeEventListener('scroll', updateScrollProgress);
  window.removeEventListener('resize', closeContextMenu);
  window.removeEventListener('resize', resizeCanvas);
  window.removeEventListener('keydown', handleGlobalKey);
});
</script>

<template>
  <div class="app-shell dream-shell" :data-scene="activeScene.id" :style="pageStyle" @contextmenu.self.prevent>
    <div class="atmosphere-layer">
      <canvas ref="backgroundCanvas" class="dust-canvas"></canvas>
      <div class="curtain-overlay"></div>
      <div class="light-gradient"></div>
    </div>

    <input ref="fileInputRef" class="hidden-input" type="file" multiple webkitdirectory @change="handleInputChange" />

    <header class="topbar dream-topbar">
      <div class="brand-block">
        <button class="sidebar-toggle" @click="uiState.sidebarCollapsed = !uiState.sidebarCollapsed"><AppIcon :name="uiState.sidebarCollapsed ? 'menu' : 'close'" :size="18" /></button>
        <div class="brand-logo">
          <span class="logo-glow"></span>
          <span class="logo-orbit orbit-a"></span>
          <span class="logo-orbit orbit-b"></span>
          <span class="logo-core"><AppIcon name="sparkle" :size="18" /></span>
        </div>
        <div class="brand-copy">
          <strong>GitNovelBox</strong>
          <span>暖光里的 GitHub 私有网盘 · 像一本被慢慢翻开的杂志</span>
        </div>
      </div>

      <div class="global-search-shell dream-search-shell">
        <span class="global-search-icon"><AppIcon name="search" :size="16" /></span>
        <span class="global-search-shortcut">⌘K</span>
        <input v-model.trim="store.state.searchQuery" class="global-search-input" type="search" placeholder="全局搜索：书名、路径、状态、本地/远端" />
      </div>

      <div class="topbar-right">
        <div class="repo-status-pill" :class="store.state.connection.ok ? 'is-ok' : 'is-waiting'">
          <span class="status-dot"></span>
          <span>{{ store.state.settings.owner || '未配置' }}/{{ store.state.settings.repo || 'repo' }}</span>
          <strong>{{ store.state.connection.ok ? '已连接' : '待校验' }}</strong>
        </div>

        <button class="user-menu-button" @click.stop="userMenuOpen = !userMenuOpen">
          <span class="avatar-badge"><AppIcon name="settings" :size="15" /></span>
          <span class="user-menu-text">设置</span>
        </button>

        <div v-if="userMenuOpen" class="user-menu" @click.stop>
          <button @click="openSettings('repo')">打开设置</button>
          <button @click="openSettings('stats')">查看统计</button>
          <button @click="openSettings('logs')">查看日志</button>
          <button @click="uiState.drawerOpen = !uiState.drawerOpen">{{ uiState.drawerOpen ? '收起属性抽屉' : '打开属性抽屉' }}</button>
        </div>
      </div>
    </header>

    <main class="drive-layout" :class="{ 'sidebar-collapsed': uiState.sidebarCollapsed }">
      <aside class="drive-sidebar warm-sidebar" :class="{ 'is-collapsed': uiState.sidebarCollapsed }">
        <section class="card nav-card warm-nav-card">
          <div class="section-head compact-head nav-card-head">
            <div>
              <h2>导航</h2>
              <p class="muted">收起时保留图标，展开时显示目录与分组。</p>
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

      <section class="drive-main dream-main">
        <section class="card ambient-stage-card">
          <div class="ambient-stage-grid">
            <div class="story-column">
              <p class="eyebrow">主界面只保留导航与网盘</p>
              <h1>{{ activeScene.title }}</h1>
              <p class="muted workspace-text">{{ activeScene.description }}</p>

              <div class="scene-tabs">
                <button
                  v-for="(scene, index) in sceneDefinitions"
                  :key="scene.id"
                  class="scene-tab"
                  :class="{ active: index === activeSceneIndex }"
                  @click="setScene(index)"
                >
                  {{ scene.label }}
                </button>
                <button class="scene-tab reset-tab" :class="{ active: uiState.timeOverride === null }" @click="clearSceneOverride">跟随滚动</button>
              </div>

              <div class="scene-narrative-grid">
                <article class="narrative-card">
                  <span class="narrative-label">阅读</span>
                  <strong>书页边缘被暖灰色的光轻轻抬起。</strong>
                  <p>全局搜索始终在上方，像熟悉的视线，而不是命令行。</p>
                </article>
                <article class="narrative-card">
                  <span class="narrative-label">沐浴</span>
                  <strong>信息被收进抽屉，界面只留下松弛和流动。</strong>
                  <p>配置、统计和日志都进入设置菜单，不再占据主场景。</p>
                </article>
                <article class="narrative-card">
                  <span class="narrative-label">睡眠</span>
                  <strong>深夜模式更静，属性面板像床头抽屉一样滑出。</strong>
                  <p>右侧保留文件属性，帮助你在安静里确认最后一个动作。</p>
                </article>
              </div>
            </div>

            <div class="ambient-column">
              <div class="light-bridge"></div>
              <div class="ambient-demo" @mousemove="handleAmbientMove" @mouseleave="resetAmbient">
                <div class="ambient-demo-copy">
                  <span class="eyebrow">看不见的控制</span>
                  <strong>把鼠标在这里移动，温度、湿度和光照会像空间本身一样变化。</strong>
                  <p class="muted">默认只保留体验文案，技术参数收进折叠卡片里。</p>
                </div>
                <div class="ambient-reading">{{ activeScene.label }}</div>
              </div>

              <button class="fold-card" :class="{ open: uiState.techOpen }" @click="uiState.techOpen = !uiState.techOpen">
                <div>
                  <span class="eyebrow">气候卡片</span>
                  <strong>{{ uiState.techOpen ? '收起技术参数' : '展开技术参数' }}</strong>
                </div>
                <span>{{ uiState.techOpen ? '－' : '＋' }}</span>
              </button>

              <transition name="soft-fade">
                <div v-if="uiState.techOpen" class="ambient-metrics-grid">
                  <article v-for="item in sceneMetaCards" :key="item.label" class="ambient-metric-card">
                    <span class="muted">{{ item.label }}</span>
                    <strong>{{ item.value }}</strong>
                    <small>{{ item.hint }}</small>
                  </article>
                </div>
              </transition>
            </div>
          </div>
        </section>

        <section
          class="card explorer-toolbar-card warm-toolbar-card"
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
            <div class="table-summary-badges">
              <span class="pill pill-muted">{{ explorerItems.length }} 项</span>
              <span class="pill pill-accent">{{ store.formatBytes(visibleMetricsEntries.reduce((sum, entry) => sum + (entry.size || 0), 0)) }}</span>
            </div>
          </div>

          <div class="toolbar-row top-actions-row">
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
              <label class="field-label">当前位置</label>
              <div class="breadcrumb-bar warm-breadcrumb-bar">
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
      </section>
    </main>

    <transition name="drawer-slide">
      <aside v-if="uiState.drawerOpen" class="inspector-drawer warm-inspector" @click.stop>
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
              <AppIcon :name="isFavorite(store.state.selectedItem.type === 'file' ? store.state.selectedItem.path : store.state.selectedItem.path) ? 'favorites' : 'dot'" :size="16" />
            </button>
            <button class="icon-button" @click="closeInspector"><AppIcon name="close" :size="16" /></button>
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
              <p class="eyebrow">设置菜单</p>
              <h2>把配置、统计和日志放回幕后</h2>
              <p class="muted">主界面只留下导航、目录与网盘内容；其余信息都安静地收在这里。</p>
            </div>
            <button class="icon-button" @click="closeSettings"><AppIcon name="close" :size="16" /></button>
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

    <footer class="drive-footer warm-footer">
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
