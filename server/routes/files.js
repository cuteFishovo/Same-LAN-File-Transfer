const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Multer config: preserve original filenames
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, req.app.get('sharedDir'));
  },
  filename: (req, file, cb) => {
    // Decode and preserve original filename (handle Chinese chars)
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, originalName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB per file
});

// GET /files - List all tracked files
router.get('/files', (req, res) => {
  try {
    const versionManager = req.app.get('versionManager');
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
    res.json({ files });
  } catch (err) {
    console.error('[Files Route] Error listing files:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /files/download - Download a file
router.get('/files/download', (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ error: 'Missing path parameter' });
    }

    const sharedDir = req.app.get('sharedDir');
    const fullPath = path.join(sharedDir, filePath);

    // Security: prevent directory traversal
    const resolvedPath = path.resolve(fullPath);
    if (!resolvedPath.startsWith(path.resolve(sharedDir))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filename = path.basename(filePath);
    const encodedFilename = encodeURIComponent(filename);

    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
    res.sendFile(fullPath);
  } catch (err) {
    console.error('[Files Route] Error downloading file:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /upload - Upload files
router.post('/upload', upload.array('files', 10), async (req, res) => {
  try {
    const versionManager = req.app.get('versionManager');
    const io = req.app.get('io');
    const sharedDir = req.app.get('sharedDir');
    const relativePath = req.body.relativePath || '';
    const results = [];

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    for (const file of req.files) {
      try {
        let finalRelativePath;

        if (relativePath) {
          // If relativePath is provided, move file to that subdirectory
          const targetDir = path.join(sharedDir, relativePath);
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }
          const targetPath = path.join(targetDir, file.filename);
          fs.renameSync(file.path, targetPath);
          finalRelativePath = path.join(relativePath, file.filename).replace(/\\/g, '/');
        } else {
          finalRelativePath = file.filename;
        }

        const result = versionManager.trackFile(finalRelativePath);

        if (result) {
          if (result.isNew) {
            io.emit('file:added', { file: result });
          } else {
            io.emit('file:changed', { file: result });
          }
        }

        results.push({
          originalName: file.originalname,
          relativePath: finalRelativePath,
          currentHash: result ? result.currentHash : null,
          size: result ? result.size : file.size,
          isNew: result ? result.isNew : false
        });
      } catch (fileErr) {
        console.error('[Files Route] Error processing file:', fileErr.message);
        results.push({
          originalName: file.originalname,
          error: fileErr.message
        });
      }
    }

    res.json({ success: true, files: results });
  } catch (err) {
    console.error('[Files Route] Error uploading files:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /versions - Get version history for a file
router.get('/versions', (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ error: 'Missing path parameter' });
    }

    const versionManager = req.app.get('versionManager');
    const versions = versionManager.getVersionHistory(filePath);

    res.json({ versions });
  } catch (err) {
    console.error('[Files Route] Error getting versions:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /versions/download - Download a specific version of a file
router.get('/versions/download', (req, res) => {
  try {
    const filePath = req.query.path;
    const versionId = req.query.versionId;

    if (!filePath) {
      return res.status(400).json({ error: 'Missing path parameter' });
    }
    if (!versionId) {
      return res.status(400).json({ error: 'Missing versionId parameter' });
    }

    const versionManager = req.app.get('versionManager');
    const versionFilePath = versionManager.getVersionContent(filePath, versionId);

    if (!versionFilePath) {
      return res.status(404).json({ error: 'Version not found' });
    }

    const filename = path.basename(filePath);
    const encodedFilename = encodeURIComponent(`${filename} (v${versionId})`);

    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
    res.sendFile(versionFilePath);
  } catch (err) {
    console.error('[Files Route] Error downloading version:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /files - Remove a file
router.delete('/files', (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ error: 'Missing path parameter' });
    }

    const versionManager = req.app.get('versionManager');
    const io = req.app.get('io');

    const result = versionManager.removeFile(filePath);
    if (!result) {
      return res.status(404).json({ error: 'File not found' });
    }

    io.emit('file:deleted', { path: filePath });
    res.json({ success: true });
  } catch (err) {
    console.error('[Files Route] Error deleting file:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
