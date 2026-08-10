import { useRef, useState, useCallback } from 'react'
import axios from 'axios'

const POLL_INTERVAL = 3000 // 每 3 秒扫描一次本地目录

/**
 * 本地目录双向同步 Hook
 * - 服务端文件变化 → 自动下载到本地
 * - 本地文件变化（轮询检测）→ 自动上传到服务端
 * - 通过 lastLocalState 防回环
 */
export default function useFileSync(serverUrl) {
  const serverUrlRef = useRef(serverUrl)
  serverUrlRef.current = serverUrl

  const dirHandleRef = useRef(null)
  const lastLocalStateRef = useRef({}) // { 'file.txt': { hash, size } }
  const pollTimerRef = useRef(null)
  const uploadingRef = useRef(false)

  const [syncDirName, setSyncDirName] = useState(() => {
    return localStorage.getItem('syncDirName') || ''
  })
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 })
  const [syncedFiles, setSyncedFiles] = useState(new Set())

  // ========== 基础工具 ==========

  /** 计算 Blob SHA-256 */
  const computeBlobHash = useCallback(async (blob) => {
    const buffer = await blob.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }, [])

  /** 递归扫描本地目录 */
  const scanDirectory = useCallback(async (dirHandle, prefix = '') => {
    const result = {}
    for await (const [name, handle] of dirHandle.entries()) {
      const fullPath = prefix ? `${prefix}/${name}` : name
      if (handle.kind === 'file') {
        try {
          const file = await handle.getFile()
          const hash = await computeBlobHash(file)
          result[fullPath] = { hash, size: file.size }
        } catch {
          // 跳过无法读取的文件（锁定、权限等）
        }
      } else if (handle.kind === 'directory') {
        const subFiles = await scanDirectory(handle, fullPath)
        Object.assign(result, subFiles)
      }
    }
    return result
  }, [computeBlobHash])

  /** 将 Blob 写入本地目录（自动创建子目录） */
  const writeFileToLocal = useCallback(async (relativePath, blob) => {
    if (!dirHandleRef.current) return
    const parts = relativePath.split('/')
    const fileName = parts.pop()
    let currentDir = dirHandleRef.current
    for (const part of parts) {
      currentDir = await currentDir.getDirectoryHandle(part, { create: true })
    }
    const fileHandle = await currentDir.getFileHandle(fileName, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(blob)
    await writable.close()
  }, [])

  /** 从本地目录删除文件 */
  const deleteFileFromLocal = useCallback(async (relativePath) => {
    if (!dirHandleRef.current) return
    const parts = relativePath.split('/')
    const fileName = parts.pop()
    let currentDir = dirHandleRef.current
    for (const part of parts) {
      try { currentDir = await currentDir.getDirectoryHandle(part) }
      catch { return }
    }
    try { await currentDir.removeEntry(fileName) }
    catch { /* 文件不存在 */ }
  }, [])

  /** 从本地目录读取文件 */
  const readFileFromLocal = useCallback(async (relativePath) => {
    if (!dirHandleRef.current) return null
    const parts = relativePath.split('/')
    const fileName = parts.pop()
    let currentDir = dirHandleRef.current
    for (const part of parts) {
      try { currentDir = await currentDir.getDirectoryHandle(part) }
      catch { return null }
    }
    try {
      const fileHandle = await currentDir.getFileHandle(fileName)
      return await fileHandle.getFile()
    } catch { return null }
  }, [])

  // ========== 本地 → 服务端 ==========

  /** 上传本地文件到服务端 */
  const uploadToServer = useCallback(async (relativePath) => {
    if (!dirHandleRef.current || uploadingRef.current) return
    const file = await readFileFromLocal(relativePath)
    if (!file) return

    uploadingRef.current = true
    try {
      const formData = new FormData()
      formData.append('files', file)
      const dirPart = relativePath.includes('/')
        ? relativePath.substring(0, relativePath.lastIndexOf('/'))
        : ''
      if (dirPart) formData.append('relativePath', dirPart)

      await axios.post(`${serverUrlRef.current}/api/upload`, formData)
      const hash = await computeBlobHash(file)
      lastLocalStateRef.current[relativePath] = { hash, size: file.size }
      setSyncedFiles((prev) => new Set(prev).add(relativePath))
    } catch (err) {
      console.error(`[Sync] 上传失败 [${relativePath}]:`, err)
    } finally {
      uploadingRef.current = false
    }
  }, [readFileFromLocal, computeBlobHash])

  /** 从服务端删除文件 */
  const deleteFromServer = useCallback(async (relativePath) => {
    try {
      await axios.delete(`${serverUrlRef.current}/api/files?path=${encodeURIComponent(relativePath)}`)
      delete lastLocalStateRef.current[relativePath]
      setSyncedFiles((prev) => {
        const next = new Set(prev)
        next.delete(relativePath)
        return next
      })
    } catch (err) {
      console.error(`[Sync] 删除失败 [${relativePath}]:`, err)
    }
  }, [])

  /** 停止轮询 */
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  /** 启动本地目录轮询（检测新增/修改/删除） */
  const startPolling = useCallback(() => {
    stopPolling()
    pollTimerRef.current = setInterval(async () => {
      if (!dirHandleRef.current || uploadingRef.current) return
      try {
        const currentState = await scanDirectory(dirHandleRef.current)
        const lastState = { ...lastLocalStateRef.current }

        for (const [path, info] of Object.entries(currentState)) {
          const last = lastState[path]
          if (!last) {
            uploadToServer(path)
          } else if (last.hash !== info.hash) {
            uploadToServer(path)
          }
        }

        for (const path of Object.keys(lastState)) {
          if (!(path in currentState)) {
            deleteFromServer(path)
          }
        }
      } catch (err) {
        console.error('[Sync] 轮询错误:', err)
      }
    }, POLL_INTERVAL)
  }, [scanDirectory, uploadToServer, deleteFromServer, stopPolling])

  // ========== 服务端 → 本地 ==========

  /** 从服务端下载单个文件到本地 */
  const downloadAndSync = useCallback(async (relativePath, expectedHash) => {
    if (!dirHandleRef.current) return false
    try {
      const lastState = lastLocalStateRef.current[relativePath]
      if (lastState && expectedHash && lastState.hash === expectedHash) {
        return true
      }

      const res = await axios.get(
        `${serverUrlRef.current}/api/files/download?path=${encodeURIComponent(relativePath)}`,
        { responseType: 'blob' }
      )
      await writeFileToLocal(relativePath, res.data)

      const hash = expectedHash || await computeBlobHash(res.data)
      lastLocalStateRef.current[relativePath] = { hash, size: res.data.size }
      setSyncedFiles((prev) => new Set(prev).add(relativePath))
      return true
    } catch (err) {
      console.error(`[Sync] 下载失败 [${relativePath}]:`, err)
      return false
    }
  }, [writeFileToLocal, computeBlobHash])

  /** 全量对比并同步（服务端 → 本地） */
  const compareAndSyncAll = useCallback(async (serverFiles) => {
    if (!dirHandleRef.current || serverFiles.length === 0) return
    setIsSyncing(true)
    setSyncProgress({ current: 0, total: serverFiles.length })

    for (let i = 0; i < serverFiles.length; i++) {
      const file = serverFiles[i]
      setSyncProgress({ current: i + 1, total: serverFiles.length })
      await downloadAndSync(file.name, file.currentHash)
    }

    setIsSyncing(false)
    setSyncProgress({ current: 0, total: 0 })
  }, [downloadAndSync])

  /** 服务端新增/修改 → 下载到本地 */
  const syncAddedOrChanged = useCallback(async (fileInfo) => {
    if (!dirHandleRef.current) return
    const lastState = lastLocalStateRef.current[fileInfo.name]
    if (lastState && lastState.hash === fileInfo.currentHash) return
    await downloadAndSync(fileInfo.name, fileInfo.currentHash)
  }, [downloadAndSync])

  /** 服务端删除 → 删除本地文件 */
  const syncDeleted = useCallback(async (relativePath) => {
    if (!dirHandleRef.current) return
    await deleteFileFromLocal(relativePath)
    delete lastLocalStateRef.current[relativePath]
    setSyncedFiles((prev) => {
      const next = new Set(prev)
      next.delete(relativePath)
      return next
    })
  }, [deleteFileFromLocal])

  // ========== 外部操作 ==========

  /** 选择本地同步目录 */
  const pickSyncDir = useCallback(async () => {
    if (!window.showDirectoryPicker) {
      alert('您的浏览器不支持 File System Access API，请使用 Chrome 或 Edge')
      return false
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
      dirHandleRef.current = handle
      setSyncDirName(handle.name)
      localStorage.setItem('syncDirName', handle.name)

      const currentState = await scanDirectory(handle)
      lastLocalStateRef.current = currentState

      startPolling()
      return true
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('选择目录失败:', err)
      }
      return false
    }
  }, [scanDirectory, startPolling])

  /** 清除同步目录绑定 */
  const clearSyncDir = useCallback(() => {
    stopPolling()
    dirHandleRef.current = null
    setSyncDirName('')
    localStorage.removeItem('syncDirName')
    setSyncedFiles(new Set())
    lastLocalStateRef.current = {}
  }, [stopPolling])

  return {
    dirHandleRef,
    syncDirName,
    isSyncing,
    syncProgress,
    syncedFiles,
    pickSyncDir,
    compareAndSyncAll,
    syncAddedOrChanged,
    syncDeleted,
    clearSyncDir,
  }
}
