export function normalizePath(value = '') {
  return String(value)
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\/+|\/+$/g, '');
}

export function normalizeRepoPrefix(prefix = 'books') {
  return normalizePath(prefix);
}

export function joinRepoPath(prefix = '', relativePath = '') {
  const left = normalizeRepoPrefix(prefix);
  const right = normalizePath(relativePath);
  return [left, right].filter(Boolean).join('/');
}

export function basename(path = '') {
  const normalized = normalizePath(path);
  if (!normalized) return '';
  const parts = normalized.split('/');
  return parts[parts.length - 1] || '';
}

export function dirname(path = '') {
  const normalized = normalizePath(path);
  if (!normalized.includes('/')) return '';
  const parts = normalized.split('/');
  parts.pop();
  return parts.join('/');
}

export function formatBytes(bytes = 0) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** power;
  return `${value.toFixed(value >= 10 || power === 0 ? 0 : 1)} ${units[power]}`;
}

export function formatDateTime(value) {
  if (!value) return '-';
  const date = typeof value === 'number' ? new Date(value) : new Date(String(value));
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function makeEntry(relativePath, local, remote) {
  const name = basename(relativePath);
  const folder = dirname(relativePath);
  let status = '未知';
  if (local && remote) {
    status = local.gitBlobSha === remote.sha ? '已同步' : '待更新';
  } else if (local && !remote) {
    status = '待上传';
  } else if (!local && remote) {
    status = '仅远端';
  }

  return {
    id: relativePath,
    type: 'file',
    name,
    folder,
    relativePath,
    local,
    remote,
    status,
    size: local?.size ?? remote?.size ?? 0,
    updatedAt: local?.mtime ?? remote?.updatedAt ?? null,
  };
}

export function buildMergedEntries(localFiles = [], remoteFiles = []) {
  const localMap = new Map(localFiles.map((item) => [normalizePath(item.relativePath), item]));
  const remoteMap = new Map(remoteFiles.map((item) => [normalizePath(item.relativePath), item]));
  const keys = new Set([...localMap.keys(), ...remoteMap.keys()]);

  const entries = [...keys].map((key) => makeEntry(key, localMap.get(key) || null, remoteMap.get(key) || null));

  return entries.sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'zh-CN'));
}

function createNode(name, path, depth) {
  return {
    id: path || 'root',
    type: 'folder',
    name,
    path,
    depth,
    children: [],
    files: 0,
    size: 0,
  };
}

function ensureFolderPath(folderPaths, path) {
  const normalized = normalizePath(path);
  if (!normalized) return;
  const parts = normalized.split('/');
  let current = '';
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    folderPaths.add(current);
  }
}

export function collectFolderPaths(entries = [], extraFolderPaths = []) {
  const folderPaths = new Set();

  for (const entry of entries) {
    ensureFolderPath(folderPaths, entry.folder);
  }

  for (const folderPath of extraFolderPaths) {
    ensureFolderPath(folderPaths, folderPath);
  }

  return [...folderPaths].sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true, sensitivity: 'base' }));
}

export function buildDirectoryTree(entries = [], extraFolderPaths = []) {
  const root = createNode('全部文件', '', 0);
  const nodeMap = new Map([['', root]]);
  const folderPaths = collectFolderPaths(entries, extraFolderPaths);

  for (const folderPath of folderPaths) {
    const parts = folderPath.split('/');
    let currentPath = '';
    let parent = root;

    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (!nodeMap.has(currentPath)) {
        const node = createNode(part, currentPath, index + 1);
        nodeMap.set(currentPath, node);
        parent.children.push(node);
      }
      parent = nodeMap.get(currentPath);
    }
  }

  for (const entry of entries) {
    root.files += 1;
    root.size += entry.size || 0;
    const folder = normalizePath(entry.folder);
    if (!folder) continue;
    const parts = folder.split('/');
    let currentPath = '';
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const node = nodeMap.get(currentPath);
      if (node) {
        node.files += 1;
        node.size += entry.size || 0;
      }
    }
  }

  const sortNodes = (node) => {
    node.children.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    node.children.forEach(sortNodes);
  };

  sortNodes(root);
  return root;
}

export function getFolderStats(entries = [], folderPath = '') {
  const normalizedFolder = normalizePath(folderPath);
  const matched = entries.filter((entry) => {
    if (!normalizedFolder) return true;
    return entry.folder === normalizedFolder || entry.relativePath.startsWith(`${normalizedFolder}/`);
  });

  const directChildren = new Set();
  for (const entry of matched) {
    const rest = normalizedFolder ? entry.relativePath.replace(`${normalizedFolder}/`, '') : entry.relativePath;
    const first = rest.split('/')[0];
    if (first) {
      directChildren.add(first);
    }
  }

  const totalSize = matched.reduce((sum, entry) => sum + (entry.size || 0), 0);
  return {
    type: 'folder',
    path: normalizedFolder,
    name: normalizedFolder ? basename(normalizedFolder) : '全部文件',
    fileCount: matched.length,
    totalSize,
    childrenCount: directChildren.size,
    syncedCount: matched.filter((entry) => entry.status === '已同步').length,
    pendingCount: matched.filter((entry) => entry.status === '待上传' || entry.status === '待更新').length,
    remoteOnlyCount: matched.filter((entry) => entry.status === '仅远端').length,
    updatedAt: matched.reduce((max, entry) => Math.max(max, entry.updatedAt || 0), 0) || null,
  };
}
