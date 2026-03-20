import { basename, dirname, normalizeRepoPrefix, normalizePath } from './path';

const API_ROOT = 'https://api.github.com';

function encodePathSegments(path) {
  return String(path)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function buildError(status, text) {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  return new Error(`GitHub API ${status}: ${cleaned || '请求失败'}`);
}

function collectAncestorFolders(path) {
  const normalized = normalizePath(path);
  if (!normalized) return [];
  const folder = dirname(normalized);
  if (!folder) return [];
  const parts = folder.split('/');
  const folders = [];
  let current = '';
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    folders.push(current);
  }
  return folders;
}

export function createGitHubClient(settings) {
  const owner = String(settings.owner || '').trim();
  const repo = String(settings.repo || '').trim();
  const branch = String(settings.branch || 'main').trim();
  const token = String(settings.token || '').trim();
  const repoPrefix = normalizeRepoPrefix(settings.repoPrefix || 'books');

  function headers(extra = {}) {
    const base = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...extra,
    };

    if (token) {
      base.Authorization = `Bearer ${token}`;
    }

    return base;
  }

  async function request(path, options = {}) {
    const response = await fetch(`${API_ROOT}${path}`, {
      ...options,
      headers: headers(options.headers),
    });

    if (!response.ok) {
      const text = await response.text();
      throw buildError(response.status, text);
    }

    if (response.status === 204) return null;
    return response.json();
  }

  function toFullPath(relativePath) {
    const normalized = normalizePath(relativePath);
    return repoPrefix ? `${repoPrefix}/${normalized}` : normalized;
  }

  function toRelativePath(fullPath) {
    const normalized = normalizePath(fullPath);
    if (!repoPrefix) return normalized;
    if (normalized === repoPrefix) return '';
    return normalized.replace(`${repoPrefix}/`, '');
  }

  async function getRepoInfo() {
    return request(`/repos/${owner}/${repo}`);
  }

  async function getBranchRef() {
    return request(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
  }

  async function getRecursiveTree() {
    const ref = await getBranchRef();
    const sha = ref.object.sha;
    const payload = await request(`/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`);
    const blobs = (payload.tree || []).filter((item) => item.type === 'blob');
    const withinPrefix = blobs.filter((item) => {
      if (!repoPrefix) return true;
      return item.path === repoPrefix || item.path.startsWith(`${repoPrefix}/`);
    });

    const folders = new Set();
    const placeholders = new Set();
    const files = [];

    for (const item of withinPrefix) {
      const relativePath = toRelativePath(item.path);
      const name = basename(relativePath);

      for (const folder of collectAncestorFolders(relativePath)) {
        folders.add(folder);
      }

      if (name === '.gitkeep') {
        const folderPath = dirname(relativePath);
        if (folderPath) {
          folders.add(folderPath);
          placeholders.add(folderPath);
        }
        continue;
      }

      if (!relativePath.toLowerCase().endsWith('.txt')) continue;

      files.push({
        name: basename(relativePath),
        fullPath: normalizePath(item.path),
        relativePath: normalizePath(relativePath),
        size: item.size || 0,
        sha: item.sha,
      });
    }

    return {
      files: files.sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'zh-CN')),
      folders: [...folders].sort((a, b) => a.localeCompare(b, 'zh-CN')),
      placeholders: [...placeholders].sort((a, b) => a.localeCompare(b, 'zh-CN')),
    };
  }

  async function getFileContent(relativePath) {
    const fullPath = toFullPath(relativePath);
    return request(`/repos/${owner}/${repo}/contents/${encodePathSegments(fullPath)}?ref=${encodeURIComponent(branch)}`);
  }

  async function putFile(relativePath, base64Content, existingSha, message) {
    const normalized = normalizePath(relativePath);
    const fullPath = toFullPath(normalized);
    const commitMessage = message || (existingSha ? `update: ${normalized}` : `create: ${normalized}`);

    return request(`/repos/${owner}/${repo}/contents/${encodePathSegments(fullPath)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: commitMessage,
        content: base64Content,
        branch,
        ...(existingSha ? { sha: existingSha } : {}),
      }),
    });
  }

  async function deleteFile(relativePath, sha, message) {
    const normalized = normalizePath(relativePath);
    const fullPath = toFullPath(normalized);
    return request(`/repos/${owner}/${repo}/contents/${encodePathSegments(fullPath)}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message || `delete: ${normalized}`,
        branch,
        sha,
      }),
    });
  }

  async function ensureFolder(relativeFolderPath) {
    const folderPath = normalizePath(relativeFolderPath);
    if (!folderPath) {
      throw new Error('请输入文件夹名称');
    }
    return putFile(`${folderPath}/.gitkeep`, '', undefined, `create folder: ${folderPath}`);
  }

  async function renameFolder(oldFolderPath, newFolderPath, currentFiles = [], placeholderFolders = []) {
    const oldPath = normalizePath(oldFolderPath);
    const newPath = normalizePath(newFolderPath);
    if (!oldPath || !newPath) {
      throw new Error('旧目录和新目录不能为空');
    }
    if (oldPath === newPath) {
      return { movedFiles: 0, deletedFiles: 0 };
    }

    const filesToMove = currentFiles.filter((file) => file.relativePath === oldPath || file.relativePath.startsWith(`${oldPath}/`));
    let movedFiles = 0;

    for (const file of filesToMove) {
      const payload = await getFileContent(file.relativePath);
      const suffix = file.relativePath === oldPath ? '' : file.relativePath.slice(oldPath.length + 1);
      const target = suffix ? `${newPath}/${suffix}` : newPath;
      await putFile(target, payload.content || '', undefined, `move: ${file.relativePath} -> ${target}`);
      await deleteFile(file.relativePath, payload.sha, `cleanup old path: ${file.relativePath}`);
      movedFiles += 1;
    }

    const hadPlaceholder = placeholderFolders.includes(oldPath) || !filesToMove.length;
    if (hadPlaceholder) {
      await ensureFolder(newPath);
      try {
        const placeholder = await getFileContent(`${oldPath}/.gitkeep`);
        await deleteFile(`${oldPath}/.gitkeep`, placeholder.sha, `remove folder placeholder: ${oldPath}`);
      } catch (error) {
        // ignore missing placeholder
      }
    }

    return { movedFiles, deletedFiles: movedFiles };
  }

  return {
    getRepoInfo,
    getRecursiveTree,
    getFileContent,
    putFile,
    deleteFile,
    ensureFolder,
    renameFolder,
  };
}
