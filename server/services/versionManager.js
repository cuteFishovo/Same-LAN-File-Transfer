const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class VersionManager {
  constructor(sharedDir, versionsDir) {
    this.sharedDir = sharedDir;
    this.versionsDir = versionsDir;
    this.manifestPath = path.join(versionsDir, 'manifest.json');
    this.objectsDir = path.join(versionsDir, 'objects');
    this._init();
  }

  _init() {
    if (!fs.existsSync(this.sharedDir)) {
      fs.mkdirSync(this.sharedDir, { recursive: true });
      console.log('[VersionManager] Created shared directory:', this.sharedDir);
    }
    if (!fs.existsSync(this.versionsDir)) {
      fs.mkdirSync(this.versionsDir, { recursive: true });
      console.log('[VersionManager] Created versions directory:', this.versionsDir);
    }
    if (!fs.existsSync(this.objectsDir)) {
      fs.mkdirSync(this.objectsDir, { recursive: true });
      console.log('[VersionManager] Created objects directory:', this.objectsDir);
    }
    if (!fs.existsSync(this.manifestPath)) {
      fs.writeFileSync(this.manifestPath, JSON.stringify({}), 'utf-8');
      console.log('[VersionManager] Initialized manifest.json');
    }
  }

  getManifest() {
    try {
      const data = fs.readFileSync(this.manifestPath, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      console.error('[VersionManager] Error reading manifest:', err.message);
      return {};
    }
  }

  saveManifest(data) {
    try {
      fs.writeFileSync(this.manifestPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[VersionManager] Error saving manifest:', err.message);
    }
  }

  computeHash(filePath) {
    const fileContent = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileContent).digest('hex');
  }

  _objectPath(hash) {
    const prefix = hash.substring(0, 2);
    const rest = hash.substring(2);
    return path.join(this.objectsDir, prefix, rest);
  }

  trackFile(relativePath) {
    try {
      const fullPath = path.join(this.sharedDir, relativePath);

      if (!fs.existsSync(fullPath)) {
        console.log('[VersionManager] File not found for tracking:', relativePath);
        return null;
      }

      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) {
        return null;
      }

      const newHash = this.computeHash(fullPath);
      const manifest = this.getManifest();
      const existing = manifest[relativePath];

      // File unchanged
      if (existing && existing.currentHash === newHash) {
        return null;
      }

      // Save new content to objects
      const newObjectPath = this._objectPath(newHash);
      const newObjectDir = path.dirname(newObjectPath);
      if (!fs.existsSync(newObjectDir)) {
        fs.mkdirSync(newObjectDir, { recursive: true });
      }
      fs.copyFileSync(fullPath, newObjectPath);

      const versions = existing ? existing.versions || [] : [];

      // If file existed before, archive old content
      if (existing) {
        const oldHash = existing.currentHash;
        const oldObjectPath = this._objectPath(oldHash);
        const oldObjectDir = path.dirname(oldObjectPath);
        if (!fs.existsSync(oldObjectDir)) {
          fs.mkdirSync(oldObjectDir, { recursive: true });
        }
        if (!fs.existsSync(oldObjectPath)) {
          const oldFullPath = path.join(this.sharedDir, relativePath);
          // We need the old content, but the file has already changed.
          // Since the old content should have been saved previously, we check
          // if we can still save it. Actually, the file on disk is now the NEW
          // version, so we can't read old content from disk. But the old
          // content should already exist in objects from the previous
          // trackFile call. Let's verify and copy if needed.
        }
      }

      // Build version history entry
      const versionEntry = {
        id: newHash.substring(0, 12),
        hash: newHash,
        size: stat.size,
        timestamp: new Date().toISOString(),
        current: true
      };

      // Mark old versions as not current
      if (existing && existing.currentHash) {
        // Archive old version: save old content if not already in objects
        const oldHash = existing.currentHash;
        const oldObjectPath = this._objectPath(oldHash);
        const oldObjectDir = path.dirname(oldObjectPath);
        if (!fs.existsSync(oldObjectDir)) {
          fs.mkdirSync(oldObjectDir, { recursive: true });
        }
        // We assume old content was saved during a previous trackFile call
        // Push old entry to history
        versions.push({
          id: oldHash.substring(0, 12),
          hash: oldHash,
          size: existing.size,
          timestamp: existing.modifiedAt,
          current: false
        });
      }

      // Update manifest
      manifest[relativePath] = {
        currentHash: newHash,
        size: stat.size,
        modifiedAt: new Date().toISOString(),
        versionId: newHash.substring(0, 12),
        versions: versions
      };

      this.saveManifest(manifest);

      const wasNew = !existing;
      console.log(`[VersionManager] ${wasNew ? 'New' : 'Changed'} file: ${relativePath} (${versionEntry.id})`);

      return {
        name: relativePath,
        relativePath: relativePath,
        currentHash: newHash,
        size: stat.size,
        modifiedAt: manifest[relativePath].modifiedAt,
        versionId: newHash.substring(0, 12),
        versions: manifest[relativePath].versions || [],
        isNew: wasNew
      };
    } catch (err) {
      console.error('[VersionManager] Error tracking file:', err.message);
      return null;
    }
  }

  removeFile(relativePath) {
    try {
      const manifest = this.getManifest();
      const entry = manifest[relativePath];

      if (!entry) {
        console.log('[VersionManager] File not in manifest for removal:', relativePath);
        return null;
      }

      // Archive current content to objects before removing from manifest
      const currentHash = entry.currentHash;
      const objectPath = this._objectPath(currentHash);
      const objectDir = path.dirname(objectPath);
      if (!fs.existsSync(objectDir)) {
        fs.mkdirSync(objectDir, { recursive: true });
      }
      if (!fs.existsSync(objectPath)) {
        const fullPath = path.join(this.sharedDir, relativePath);
        if (fs.existsSync(fullPath)) {
          fs.copyFileSync(fullPath, objectPath);
        }
      }

      delete manifest[relativePath];
      this.saveManifest(manifest);

      // Delete file from shared directory
      const filePath = path.join(this.sharedDir, relativePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      console.log('[VersionManager] Removed file:', relativePath);
      return { path: relativePath };
    } catch (err) {
      console.error('[VersionManager] Error removing file:', err.message);
      return null;
    }
  }

  getVersionHistory(relativePath) {
    try {
      const manifest = this.getManifest();
      const entry = manifest[relativePath];

      if (!entry) {
        return [];
      }

      const history = [
        {
          id: entry.currentHash.substring(0, 12),
          hash: entry.currentHash,
          size: entry.size,
          timestamp: entry.modifiedAt,
          current: true
        }
      ];

      if (entry.versions && entry.versions.length > 0) {
        history.push(...entry.versions);
      }

      return history;
    } catch (err) {
      console.error('[VersionManager] Error getting version history:', err.message);
      return [];
    }
  }

  getVersionContent(relativePath, versionId) {
    try {
      const history = this.getVersionHistory(relativePath);
      const version = history.find(v => v.id === versionId || v.hash === versionId);

      if (!version) {
        return null;
      }

      const objectPath = this._objectPath(version.hash);
      if (fs.existsSync(objectPath)) {
        return objectPath;
      }

      return null;
    } catch (err) {
      console.error('[VersionManager] Error getting version content:', err.message);
      return null;
    }
  }
}

module.exports = VersionManager;
