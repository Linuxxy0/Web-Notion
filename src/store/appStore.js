import { computed, reactive } from 'vue';
import { createGitHubClient } from '../lib/github';
import { scanInputFileList, pickDirectoryAndScan, rescanDirectoryHandle, isDirectoryPickerSupported } from '../lib/localScan';
import { buildDirectoryTree, buildMergedEntries, collectFolderPaths, dirname, formatBytes, formatDateTime, getFolderStats, normalizePath } from '../lib/path';
import { fileToBase64 } from '../lib/crypto';
import { base64ToBytes, decodeBytesBestEffort, downloadTextFile, readFileTextBestEffort, truncateText } from '../lib/text';
import { loadLogs, loadMetrics, loadSettings, saveLogs, saveSettings, updateMetrics } from '../lib/storage';

const state = reactive({
  settings: loadSettings(),
  localFiles: [],
  remoteFiles: [],
  remoteFolders: [],
  remotePlaceholderFolders: [],
  logs: loadLogs(),
  metricsHistory: loadMetrics(),
  busy: false,
  busyLabel: '',
  searchQuery: '',
  searchScope: '全部',
  statusFilter: '全部',
  sortField: 'path',
  sortDirection: 'asc',
  viewMode: 'list',
  selectedFolder: '',
  selectedEntryId: '',
  selectedItem: {
    type: 'folder',
    path: '',
  },
  preview: {
    source: '',
    encoding: '',
    text: '',
    error: '',
    updatedAt: null,
  },
  connection: {
    ok: false,
    message: '未校验仓库',
  },
  localHandle: null,
  localSourceLabel: '未选择本地目录',
  skippedLocalItems: [],
  lastSyncSummary: null,
});

const mergedEntries = computed(() => buildMergedEntries(state.localFiles, state.remoteFiles));
const allFolderPaths = computed(() => collectFolderPaths(mergedEntries.value, state.remoteFolders));
const directoryTree = computed(() => buildDirectoryTree(mergedEntries.value, state.remoteFolders));
const selectedEntry = computed(() => mergedEntries.value.find((item) => item.id === state.selectedEntryId) || null);
const selectedFolderInfo = computed(() => getFolderStats(mergedEntries.value, state.selectedItem.type === 'folder' ? state.selectedItem.path : state.selectedFolder));
const selectedInspector = computed(() => {
  if (state.selectedItem.type === 'file' && selectedEntry.value) {
    return {
      type: 'file',
      ...selectedEntry.value,
      sourceLabel: `${selectedEntry.value.local ? '本地' : ''}${selectedEntry.value.local && selectedEntry.value.remote ? ' / ' : ''}${selectedEntry.value.remote ? '远端' : ''}` || '-',
    };
  }
  return selectedFolderInfo.value;
});
const pendingCount = computed(() => mergedEntries.value.filter((item) => ['待上传', '待更新'].includes(item.status)).length);
const remoteOnlyCount = computed(() => mergedEntries.value.filter((item) => item.status === '仅远端').length);

function compareEntries(a, b) {
  const dir = state.sortDirection === 'desc' ? -1 : 1;
  const statusWeight = {
    '待上传': 1,
    '待更新': 2,
    '仅远端': 3,
    '已同步': 4,
    '未知': 5,
  };

  const pick = (entry) => {
    switch (state.sortField) {
      case 'name':
        return entry.name;
      case 'size':
        return entry.size || 0;
      case 'status':
        return statusWeight[entry.status] || 999;
      case 'updatedAt':
        return entry.updatedAt || 0;
      case 'source':
        return `${entry.local ? 'L' : ''}${entry.remote ? 'R' : ''}`;
      case 'path':
      default:
        return entry.relativePath;
    }
  };

  const left = pick(a);
  const right = pick(b);

  if (typeof left === 'number' && typeof right === 'number') {
    if (left === right) return a.relativePath.localeCompare(b.relativePath, 'zh-CN');
    return (left - right) * dir;
  }

  const textCompare = String(left).localeCompare(String(right), 'zh-CN', { numeric: true, sensitivity: 'base' });
  if (textCompare === 0) {
    return a.relativePath.localeCompare(b.relativePath, 'zh-CN', { numeric: true, sensitivity: 'base' }) * dir;
  }
  return textCompare * dir;
}

const filteredEntries = computed(() => {
  const query = state.searchQuery.trim().toLowerCase();

  return mergedEntries.value
    .filter((entry) => {
      const folderMatch = !state.selectedFolder || entry.folder === state.selectedFolder || entry.relativePath.startsWith(`${state.selectedFolder}/`);
      const statusMatch = state.statusFilter === '全部' || entry.status === state.statusFilter;

      if (!query) {
        return folderMatch && statusMatch;
      }

      const inName = entry.name.toLowerCase().includes(query);
      const inPath = entry.relativePath.toLowerCase().includes(query);
      const inStatus = entry.status.toLowerCase().includes(query);
      const inSource = `${entry.local ? '本地' : ''}${entry.remote ? '远端' : ''}`.includes(query);

      let queryMatch = false;
      switch (state.searchScope) {
        case '文件名':
          queryMatch = inName;
          break;
        case '路径':
          queryMatch = inPath;
          break;
        case '状态':
          queryMatch = inStatus || inSource;
          break;
        case '全部':
        default:
          queryMatch = inName || inPath || inStatus || inSource;
          break;
      }

      return folderMatch && statusMatch && queryMatch;
    })
    .sort(compareEntries);
});

const filteredSize = computed(() => filteredEntries.value.reduce((sum, entry) => sum + (entry.size || 0), 0));

function persistSettings() {
  saveSettings(state.settings);
  log('info', '配置已保存', `${state.settings.owner}/${state.settings.repo || '-'}`);
}

function log(level, message, detail = '') {
  const entry = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    time: new Date().toISOString(),
    level,
    message,
    detail,
  };
  state.logs = [entry, ...state.logs].slice(0, 200);
  saveLogs(state.logs);
}

function setBusy(flag, label = '') {
  state.busy = flag;
  state.busyLabel = label;
}

function client() {
  return createGitHubClient(state.settings);
}

function requireRepoConfig() {
  if (!state.settings.owner || !state.settings.repo || !state.settings.branch) {
    throw new Error('请先填写 Owner / Repo / Branch');
  }
}

function resetPreview() {
  state.preview = {
    source: '',
    encoding: '',
    text: '',
    error: '',
    updatedAt: null,
  };
}

function applyLocalScanResult(result) {
  state.localFiles = result.files;
  state.localHandle = result.handle;
  state.localSourceLabel = result.sourceLabel;
  state.skippedLocalItems = result.skipped;
  if (result.skipped.length) {
    log('warn', `本地扫描完成，已跳过 ${result.skipped.length} 个文件`, result.skipped.slice(0, 5).map((item) => `${item.reason}:${item.path}`).join(' | '));
  } else {
    log('info', '本地扫描完成', `共 ${result.files.length} 个 TXT 文件`);
  }
}

function applyRemoteTree(payload) {
  state.remoteFiles = payload.files;
  state.remoteFolders = payload.folders;
  state.remotePlaceholderFolders = payload.placeholders;
}

function upsertRemoteFile(remoteFile) {
  const index = state.remoteFiles.findIndex((item) => item.relativePath === remoteFile.relativePath);
  if (index >= 0) {
    state.remoteFiles[index] = remoteFile;
  } else {
    state.remoteFiles.push(remoteFile);
    state.remoteFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'zh-CN'));
  }
}

function removeRemoteFile(relativePath) {
  state.remoteFiles = state.remoteFiles.filter((item) => item.relativePath !== relativePath);
}

function refreshRemoteFoldersFromState() {
  state.remoteFolders = collectFolderPaths(state.remoteFiles, state.remotePlaceholderFolders);
}

async function validateRepo() {
  requireRepoConfig();
  setBusy(true, '正在校验 GitHub 仓库...');
  try {
    const repoInfo = await client().getRepoInfo();
    state.connection.ok = true;
    state.connection.message = `${repoInfo.full_name} · ${repoInfo.private ? '私有' : '公开'}`;
    log('info', '仓库校验成功', state.connection.message);
  } catch (error) {
    state.connection.ok = false;
    state.connection.message = error.message || '仓库校验失败';
    log('error', '仓库校验失败', state.connection.message);
    throw error;
  } finally {
    setBusy(false);
  }
}

async function loadRemoteTree() {
  requireRepoConfig();
  setBusy(true, '正在读取远端仓库树...');
  try {
    const payload = await client().getRecursiveTree();
    applyRemoteTree(payload);
    log('info', '远端仓库树已更新', `TXT 文件 ${payload.files.length} 个，目录 ${payload.folders.length} 个`);
  } finally {
    setBusy(false);
  }
}

async function chooseLocalDirectory() {
  setBusy(true, '正在读取本地目录...');
  try {
    const result = await pickDirectoryAndScan(state.settings);
    applyLocalScanResult(result);
  } finally {
    setBusy(false);
  }
}

async function loadLocalFromInput(fileList) {
  setBusy(true, '正在导入本地目录...');
  try {
    const result = await scanInputFileList(fileList, state.settings);
    applyLocalScanResult(result);
  } finally {
    setBusy(false);
  }
}

async function rescanLocalDirectory() {
  if (!state.localHandle) {
    throw new Error('当前浏览器没有可复用的目录句柄，请重新选择目录');
  }
  setBusy(true, '正在重新扫描本地目录...');
  try {
    const result = await rescanDirectoryHandle(state.localHandle, state.settings);
    applyLocalScanResult(result);
  } finally {
    setBusy(false);
  }
}

function selectEntry(entry) {
  if (!entry) return;
  state.selectedEntryId = entry.id;
  state.selectedItem = {
    type: 'file',
    id: entry.id,
    path: entry.relativePath,
  };
}

function selectFolder(path) {
  const normalized = normalizePath(path);
  state.selectedFolder = normalized;
  state.selectedEntryId = '';
  state.selectedItem = {
    type: 'folder',
    path: normalized,
  };
  resetPreview();
}

async function previewEntry(entry, source = 'best') {
  if (!entry) return;
  selectEntry(entry);
  state.preview = {
    source: '',
    encoding: '',
    text: '',
    error: '',
    updatedAt: new Date().toISOString(),
  };

  try {
    if ((source === 'local' || source === 'best') && entry.local) {
      const { text, encoding } = await readFileTextBestEffort(entry.local.file);
      state.preview = {
        source: 'local',
        encoding,
        text: truncateText(text),
        error: '',
        updatedAt: new Date().toISOString(),
      };
      return;
    }

    if (entry.remote) {
      const payload = await client().getFileContent(entry.relativePath);
      const bytes = base64ToBytes(payload.content || '');
      const { text, encoding } = decodeBytesBestEffort(bytes);
      state.preview = {
        source: 'remote',
        encoding,
        text: truncateText(text),
        error: '',
        updatedAt: new Date().toISOString(),
      };
      return;
    }

    state.preview.error = '当前条目没有可预览内容';
  } catch (error) {
    state.preview.error = error.message || '预览失败';
    log('error', '文件预览失败', state.preview.error);
  }
}

async function syncEntry(entry, options = {}) {
  const trackMetrics = options.trackMetrics ?? true;
  if (!entry) return { success: 0, fail: 0, uploadBytes: 0, deleteCount: 0 };
  requireRepoConfig();

  if (entry.status === '仅远端') {
    if (!state.settings.deleteRemoteMissing || !options.allowDelete) {
      return { success: 0, fail: 0, uploadBytes: 0, deleteCount: 0 };
    }
    await client().deleteFile(entry.relativePath, entry.remote.sha);
    removeRemoteFile(entry.relativePath);
    refreshRemoteFoldersFromState();
    log('info', '已删除远端文件', entry.relativePath);
    if (trackMetrics) {
      state.metricsHistory = updateMetrics({ successCount: 1 });
    }
    return { success: 1, fail: 0, uploadBytes: 0, deleteCount: 1 };
  }

  if (!entry.local || !['待上传', '待更新'].includes(entry.status)) {
    return { success: 0, fail: 0, uploadBytes: 0, deleteCount: 0 };
  }

  const base64 = await fileToBase64(entry.local.file);
  const payload = await client().putFile(entry.relativePath, base64, entry.remote?.sha);
  const updated = {
    relativePath: entry.relativePath,
    fullPath: payload.content?.path || entry.relativePath,
    name: entry.name,
    size: entry.local.size,
    sha: payload.content?.sha || entry.local.gitBlobSha,
  };
  upsertRemoteFile(updated);
  refreshRemoteFoldersFromState();
  log('info', entry.status === '待上传' ? '文件已上传' : '文件已更新', entry.relativePath);
  if (trackMetrics) {
    state.metricsHistory = updateMetrics({
      uploadBytes: entry.local.size,
      uploadCount: 1,
      successCount: 1,
    });
  }
  return { success: 1, fail: 0, uploadBytes: entry.local.size, deleteCount: 0 };
}

async function syncAll() {
  requireRepoConfig();
  const targets = mergedEntries.value.filter((entry) => {
    if (['待上传', '待更新'].includes(entry.status)) return true;
    return state.settings.deleteRemoteMissing && entry.status === '仅远端';
  });

  if (!targets.length) {
    log('info', '无需同步', '当前没有待上传、待更新或待删除项目');
    return;
  }

  const startedAt = Date.now();
  let success = 0;
  let fail = 0;
  let uploadBytes = 0;
  let deleteCount = 0;

  setBusy(true, `正在同步 ${targets.length} 个项目...`);

  for (let index = 0; index < targets.length; index += 1) {
    const entry = targets[index];
    state.busyLabel = `正在同步 ${index + 1}/${targets.length}: ${entry.relativePath}`;
    try {
      const result = await syncEntry(entry, { allowDelete: true, trackMetrics: false });
      success += result.success;
      fail += result.fail;
      uploadBytes += result.uploadBytes;
      deleteCount += result.deleteCount;
    } catch (error) {
      fail += 1;
      log('error', '同步失败', `${entry.relativePath} · ${error.message || error}`);
    }
  }

  const durationMs = Date.now() - startedAt;
  state.metricsHistory = updateMetrics({
    syncRuns: 1,
    uploadBytes,
    uploadCount: success - deleteCount,
    successCount: success,
    failCount: fail,
    durationMs,
  });

  state.lastSyncSummary = {
    startedAt,
    finishedAt: Date.now(),
    total: targets.length,
    success,
    fail,
    uploadBytes,
    deleteCount,
    durationMs,
  };

  setBusy(false);
  log('info', '同步完成', `成功 ${success}，失败 ${fail}，上传 ${formatBytes(uploadBytes)}`);
}

async function downloadRemote(entry) {
  if (!entry?.remote) return;
  const payload = await client().getFileContent(entry.relativePath);
  const bytes = base64ToBytes(payload.content || '');
  const { text } = decodeBytesBestEffort(bytes);
  downloadTextFile(entry.name, text);
  state.metricsHistory = updateMetrics({
    downloadBytes: bytes.byteLength,
    downloadCount: 1,
  });
  log('info', '已下载远端文件', entry.relativePath);
}

function folderAlreadyExists(folderPath) {
  const normalized = normalizePath(folderPath);
  return allFolderPaths.value.includes(normalized);
}

async function createFolder(parentPath, folderName) {
  requireRepoConfig();
  const safeName = normalizePath(folderName);
  if (!safeName || safeName.includes('/')) {
    throw new Error('文件夹名称不能为空，且不能包含 /');
  }
  const targetPath = normalizePath([parentPath, safeName].filter(Boolean).join('/'));
  if (folderAlreadyExists(targetPath)) {
    throw new Error('该文件夹已存在');
  }

  setBusy(true, `正在创建文件夹 ${targetPath} ...`);
  try {
    await client().ensureFolder(targetPath);
    const payload = await client().getRecursiveTree();
    applyRemoteTree(payload);
    selectFolder(targetPath);
    log('info', '已创建远端文件夹', targetPath);
  } finally {
    setBusy(false);
  }
}

async function renameFolder(folderPath, newName) {
  requireRepoConfig();
  const oldPath = normalizePath(folderPath);
  const safeName = normalizePath(newName);
  if (!oldPath) {
    throw new Error('根目录不能重命名');
  }
  if (!safeName || safeName.includes('/')) {
    throw new Error('新文件夹名称不能为空，且不能包含 /');
  }

  const parentPath = dirname(oldPath);
  const newPath = normalizePath(parentPath ? `${parentPath}/${safeName}` : safeName);
  if (oldPath === newPath) return;
  if (folderAlreadyExists(newPath)) {
    throw new Error('目标名称已存在');
  }

  setBusy(true, `正在重命名文件夹 ${oldPath} ...`);
  try {
    const result = await client().renameFolder(oldPath, newPath, state.remoteFiles, state.remotePlaceholderFolders);
    const payload = await client().getRecursiveTree();
    applyRemoteTree(payload);
    selectFolder(newPath);
    log('info', '文件夹已重命名', `${oldPath} → ${newPath}，迁移 ${result.movedFiles} 个文件`);
  } finally {
    setBusy(false);
  }
}

function clearLogs() {
  state.logs = [];
  saveLogs([]);
}

function clearSearch() {
  state.searchQuery = '';
  state.searchScope = '全部';
  state.statusFilter = '全部';
  state.sortField = 'path';
  state.sortDirection = 'asc';
}

function bootstrap() {
  selectFolder('');
  if (state.settings.owner && state.settings.repo) {
    log('info', '应用已加载', '本地配置已恢复');
  }
}

export function useAppStore() {
  return {
    state,
    mergedEntries,
    filteredEntries,
    filteredSize,
    directoryTree,
    selectedEntry,
    selectedInspector,
    pendingCount,
    remoteOnlyCount,
    directoryPickerSupported: isDirectoryPickerSupported(),
    persistSettings,
    validateRepo,
    loadRemoteTree,
    chooseLocalDirectory,
    loadLocalFromInput,
    rescanLocalDirectory,
    selectEntry,
    previewEntry,
    syncEntry,
    syncAll,
    downloadRemote,
    selectFolder,
    createFolder,
    renameFolder,
    clearLogs,
    clearSearch,
    bootstrap,
    formatBytes,
    formatDateTime,
  };
}
