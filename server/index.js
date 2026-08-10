const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const VersionManager = require('./services/versionManager');
const { setupFileWatcher } = require('./services/fileWatcher');
const filesRouter = require('./routes/files');

const app = express();
const server = http.createServer(app);

// CORS: allow all origins
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 100 * 1024 * 1024 // 100MB
});

// Paths — accept custom shared folder via CLI: node index.js --dir /path/to/folder
let sharedDir = path.join(__dirname, 'shared');
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--dir' || args[i] === '-d') {
    sharedDir = path.resolve(args[i + 1] || sharedDir);
    i++;
  } else if (i === 0 && !args[i].startsWith('-')) {
    // Positional: node index.js /path/to/folder
    sharedDir = path.resolve(args[i]);
  }
}
const versionsDir = path.join(sharedDir, '.sync-versions');

// Auto-create directories
if (!fs.existsSync(sharedDir)) {
  fs.mkdirSync(sharedDir, { recursive: true });
  console.log('[Server] Created shared directory:', sharedDir);
}
if (!fs.existsSync(versionsDir)) {
  fs.mkdirSync(versionsDir, { recursive: true });
  console.log('[Server] Created versions directory:', versionsDir);
}

// Initialize VersionManager
const versionManager = new VersionManager(sharedDir, versionsDir);

// Store references for routes
app.set('versionManager', versionManager);
app.set('io', io);
app.set('sharedDir', sharedDir);

// Mount API routes
app.use('/api', filesRouter);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('[Server] Client connected:', socket.id);

  // Send current file list on connection
  const manifest = versionManager.getManifest();
  const files = Object.entries(manifest).map(([name, info]) => ({
    name: name,
    relativePath: name,
    currentHash: info.currentHash,
    size: info.size,
    modifiedAt: info.modifiedAt,
    versionId: info.versionId,
    versions: info.versions || []
  }));

  socket.emit('connected', {
    serverName: 'SyncHub Server',
    sharedDir: sharedDir,
    files: files
  });

  // Handle request-files event
  socket.on('request-files', () => {
    const updatedManifest = versionManager.getManifest();
    const updatedFiles = Object.entries(updatedManifest).map(([name, info]) => ({
      name: name,
      relativePath: name,
      currentHash: info.currentHash,
      size: info.size,
      modifiedAt: info.modifiedAt,
      versionId: info.versionId,
      versions: info.versions || []
    }));

    socket.emit('files:update', { files: updatedFiles });
  });

  socket.on('disconnect', () => {
    console.log('[Server] Client disconnected:', socket.id);
  });
});

// Start server
const PORT = 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] SyncHub Server running on http://0.0.0.0:${PORT}`);
  console.log(`[Server] Shared directory: ${sharedDir}`);
  console.log(`[Server] Versions directory: ${versionsDir}`);

  // Setup file watcher
  setupFileWatcher(sharedDir, versionManager, io);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[Server] Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[Server] Shutting down...');
  process.exit(0);
});
