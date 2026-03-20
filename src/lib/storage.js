const SETTINGS_KEY = 'gitnovelbox.settings';
const LOGS_KEY = 'gitnovelbox.logs';
const METRICS_KEY = 'gitnovelbox.metrics';

export const defaultSettings = {
  token: '',
  owner: '',
  repo: '',
  branch: 'main',
  repoPrefix: 'books',
  maxFileSizeMB: 5,
  rememberToken: false,
  ignoreHidden: true,
  deleteRemoteMissing: false,
};

function safeRead(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

export function loadSettings() {
  return {
    ...defaultSettings,
    ...safeRead(SETTINGS_KEY, {}),
  };
}

export function saveSettings(settings) {
  const payload = { ...settings };
  if (!payload.rememberToken) {
    payload.token = '';
  }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
}

export function loadLogs() {
  return safeRead(LOGS_KEY, []);
}

export function saveLogs(logs) {
  localStorage.setItem(LOGS_KEY, JSON.stringify(logs.slice(0, 200)));
}

export function loadMetrics() {
  return safeRead(METRICS_KEY, []);
}

export function saveMetrics(metrics) {
  localStorage.setItem(METRICS_KEY, JSON.stringify(metrics));
}

export function updateMetrics(patch) {
  const metrics = loadMetrics();
  const today = new Date().toISOString().slice(0, 10);
  const existing = metrics.find((item) => item.date === today);
  if (existing) {
    Object.assign(existing, {
      uploadBytes: 0,
      uploadCount: 0,
      downloadBytes: 0,
      downloadCount: 0,
      syncRuns: 0,
      successCount: 0,
      failCount: 0,
      durationMs: 0,
      ...existing,
      ...patch,
      uploadBytes: (existing.uploadBytes || 0) + (patch.uploadBytes || 0),
      uploadCount: (existing.uploadCount || 0) + (patch.uploadCount || 0),
      downloadBytes: (existing.downloadBytes || 0) + (patch.downloadBytes || 0),
      downloadCount: (existing.downloadCount || 0) + (patch.downloadCount || 0),
      syncRuns: (existing.syncRuns || 0) + (patch.syncRuns || 0),
      successCount: (existing.successCount || 0) + (patch.successCount || 0),
      failCount: (existing.failCount || 0) + (patch.failCount || 0),
      durationMs: (existing.durationMs || 0) + (patch.durationMs || 0),
    });
  } else {
    metrics.push({
      date: today,
      uploadBytes: patch.uploadBytes || 0,
      uploadCount: patch.uploadCount || 0,
      downloadBytes: patch.downloadBytes || 0,
      downloadCount: patch.downloadCount || 0,
      syncRuns: patch.syncRuns || 0,
      successCount: patch.successCount || 0,
      failCount: patch.failCount || 0,
      durationMs: patch.durationMs || 0,
    });
  }

  metrics.sort((a, b) => a.date.localeCompare(b.date));
  saveMetrics(metrics.slice(-60));
  return metrics.slice(-60);
}
