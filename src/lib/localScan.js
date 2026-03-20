import { computeFileDigests } from './crypto';
import { basename, normalizePath } from './path';

function shouldIgnore(name, settings) {
  if (!name) return true;
  if (settings.ignoreHidden && name.startsWith('.')) return true;
  return false;
}

function maxBytes(settings) {
  return Number(settings.maxFileSizeMB || 5) * 1024 * 1024;
}

async function buildLocalFile(file, relativePath) {
  const { sha256, gitBlobSha } = await computeFileDigests(file);
  return {
    id: normalizePath(relativePath),
    name: basename(relativePath),
    relativePath: normalizePath(relativePath),
    size: file.size,
    mtime: file.lastModified,
    sha256,
    gitBlobSha,
    file,
  };
}

async function walkDirectory(handle, currentPath, settings, files, skipped) {
  for await (const [name, entry] of handle.entries()) {
    if (shouldIgnore(name, settings)) {
      skipped.push({ path: normalizePath(`${currentPath}/${name}`), reason: 'hidden' });
      continue;
    }

    const relativePath = normalizePath(currentPath ? `${currentPath}/${name}` : name);
    if (entry.kind === 'directory') {
      await walkDirectory(entry, relativePath, settings, files, skipped);
      continue;
    }

    if (!name.toLowerCase().endsWith('.txt')) continue;

    const file = await entry.getFile();
    if (file.size > maxBytes(settings)) {
      skipped.push({ path: relativePath, reason: 'oversize' });
      continue;
    }

    files.push(await buildLocalFile(file, relativePath));
  }
}

export function isDirectoryPickerSupported() {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

export async function pickDirectoryAndScan(settings) {
  const handle = await window.showDirectoryPicker({ mode: 'read' });
  const files = [];
  const skipped = [];
  await walkDirectory(handle, '', settings, files, skipped);
  return {
    handle,
    files,
    skipped,
    sourceLabel: handle.name || '已选择目录',
  };
}

export async function rescanDirectoryHandle(handle, settings) {
  const files = [];
  const skipped = [];
  await walkDirectory(handle, '', settings, files, skipped);
  return {
    handle,
    files,
    skipped,
    sourceLabel: handle?.name || '已选择目录',
  };
}

function normalizeInputRelativePath(file) {
  const raw = normalizePath(file.webkitRelativePath || file.name);
  const parts = raw.split('/');
  return parts.length > 1 ? parts.slice(1).join('/') : raw;
}

export async function scanInputFileList(fileList, settings) {
  const files = [];
  const skipped = [];

  for (const file of Array.from(fileList || [])) {
    const relativePath = normalizeInputRelativePath(file);
    const name = basename(relativePath);

    if (shouldIgnore(name, settings)) {
      skipped.push({ path: relativePath, reason: 'hidden' });
      continue;
    }

    if (!name.toLowerCase().endsWith('.txt')) continue;
    if (file.size > maxBytes(settings)) {
      skipped.push({ path: relativePath, reason: 'oversize' });
      continue;
    }

    files.push(await buildLocalFile(file, relativePath));
  }

  const rootName = Array.from(fileList || [])[0]?.webkitRelativePath?.split('/')?.[0] || '已选择目录';
  return {
    handle: null,
    files,
    skipped,
    sourceLabel: rootName,
  };
}
