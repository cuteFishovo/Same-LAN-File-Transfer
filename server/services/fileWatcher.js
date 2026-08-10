const chokidar = require('chokidar');
const path = require('path');

function setupFileWatcher(sharedDir, versionManager, io) {
  const debounceTimers = new Map();

  function debounce(filePath, callback) {
    const existing = debounceTimers.get(filePath);
    if (existing) {
      clearTimeout(existing);
    }
    debounceTimers.set(filePath, setTimeout(() => {
      debounceTimers.delete(filePath);
      callback();
    }, 300));
  }

  const watcher = chokidar.watch(sharedDir, {
    ignored: /(^|[\/\\])\..|node_modules/,
    persistent: true,
    ignoreInitial: true
  });

  watcher.on('add', (filePath) => {
    const relativePath = path.relative(sharedDir, filePath);
    debounce(filePath, () => {
      const result = versionManager.trackFile(relativePath);
      if (result) {
        io.emit('file:added', { file: result });
        console.log('[FileWatcher] Emitted file:added for:', relativePath);
      }
    });
  });

  watcher.on('change', (filePath) => {
    const relativePath = path.relative(sharedDir, filePath);
    debounce(filePath, () => {
      const result = versionManager.trackFile(relativePath);
      if (result) {
        io.emit('file:changed', { file: result });
        console.log('[FileWatcher] Emitted file:changed for:', relativePath);
      }
    });
  });

  watcher.on('unlink', (filePath) => {
    const relativePath = path.relative(sharedDir, filePath);
    const result = versionManager.removeFile(relativePath);
    if (result) {
      io.emit('file:deleted', { path: relativePath });
      console.log('[FileWatcher] Emitted file:deleted for:', relativePath);
    }
  });

  watcher.on('error', (error) => {
    console.error('[FileWatcher] Watcher error:', error);
  });

  watcher.on('ready', () => {
    console.log('[FileWatcher] File watcher is ready, monitoring:', sharedDir);
  });

  return watcher;
}

module.exports = { setupFileWatcher };
