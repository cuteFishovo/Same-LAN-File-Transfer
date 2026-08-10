import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import {
  FolderSync, Upload, Download, Trash2, Wifi, WifiOff, AlertTriangle,
  FolderDown, RefreshCw, CheckCircle2, XCircle, FolderOpen,
} from 'lucide-react'
import useSocket from './hooks/useSocket'
import useFileSync from './hooks/useFileSync'
import FileTree from './components/FileTree'
import FileList from './components/FileList'
import VersionHistory from './components/VersionHistory'
import UploadDialog from './components/UploadDialog'

const DEFAULT_SERVER = 'http://localhost:3001'

export default function App() {
  const [files, setFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [versions, setVersions] = useState([])
  const [showUpload, setShowUpload] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [serverUrl, setServerUrl] = useState(() => {
    return localStorage.getItem('syncServerUrl') || DEFAULT_SERVER
  })
  const [connectionStatus, setConnectionStatus] = useState('connecting')

  const { socket, isConnected } = useSocket(serverUrl)

  // 本地目录同步
  const {
    syncDirName,
    isSyncing,
    syncProgress,
    syncedFiles,
    pickSyncDir,
    compareAndSyncAll,
    syncAddedOrChanged,
    syncDeleted,
    clearSyncDir,
  } = useFileSync(serverUrl)

  // 记录初始连接时的文件列表，用于触发全量同步
  const initialSyncDoneRef = useRef(false)

  // Keep connectionStatus in sync with isConnected
  useEffect(() => {
    if (isConnected) {
      setConnectionStatus('connected')
    } else {
      setConnectionStatus('disconnected')
    }
  }, [isConnected])

  // Socket event listeners
  useEffect(() => {
    if (!socket) return

    socket.on('connected', (data) => {
      if (data.files) {
        setFiles(data.files)
      }
      setConnectionStatus('connected')

      // 连接后如果有本地同步目录，执行全量对比同步
      if (syncDirName && !initialSyncDoneRef.current && data.files?.length > 0) {
        initialSyncDoneRef.current = true
        compareAndSyncAll(data.files)
      }
    })

    socket.on('files:update', (data) => {
      if (data.files) {
        setFiles(data.files)
      }
    })

    socket.on('file:added', (data) => {
      setFiles((prev) => {
        const exists = prev.some((f) => f.name === data.file.name)
        if (exists) return prev
        return [...prev, data.file]
      })
      // 自动同步到本地目录
      if (syncDirName) {
        syncAddedOrChanged(data.file)
      }
    })

    socket.on('file:changed', (data) => {
      setFiles((prev) =>
        prev.map((f) => (f.name === data.file.name ? data.file : f))
      )
      // 自动同步到本地目录
      if (syncDirName) {
        syncAddedOrChanged(data.file)
      }
    })

    socket.on('file:deleted', (data) => {
      setFiles((prev) => prev.filter((f) => f.name !== data.path))
      if (selectedFile === data.path) {
        setSelectedFile(null)
        setVersions([])
      }
      // 自动同步删除到本地目录
      if (syncDirName) {
        syncDeleted(data.path)
      }
    })

    return () => {
      socket.off('connected')
      socket.off('files:update')
      socket.off('file:added')
      socket.off('file:changed')
      socket.off('file:deleted')
    }
  }, [socket, selectedFile, syncDirName, compareAndSyncAll, syncAddedOrChanged, syncDeleted])

  const fetchFiles = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await axios.get(`${serverUrl}/api/files`)
      setFiles(res.data.files || [])
    } catch (err) {
      console.error('获取文件列表失败:', err)
    } finally {
      setIsLoading(false)
    }
  }, [serverUrl])

  const fetchVersions = useCallback(async (path) => {
    try {
      const res = await axios.get(`${serverUrl}/api/versions?path=${encodeURIComponent(path)}`)
      setVersions(res.data.versions || [])
    } catch (err) {
      console.error('获取版本历史失败:', err)
      setVersions([])
    }
  }, [serverUrl])

  const handleSelectFile = useCallback(
    (name) => {
      setSelectedFile((prev) => (prev === name ? null : name))
      if (name && name !== selectedFile) {
        fetchVersions(name)
      } else if (!name || name === selectedFile) {
        setVersions([])
      }
    },
    [fetchVersions, selectedFile]
  )

  const handleDownload = useCallback((name) => {
    window.open(`${serverUrl}/api/files/download?path=${encodeURIComponent(name)}`, '_blank')
  }, [serverUrl])

  const handleUpload = useCallback(async (fileList, relativePath) => {
    const formData = new FormData()
    for (let i = 0; i < fileList.length; i++) {
      formData.append('files', fileList[i])
    }
    if (relativePath) {
      formData.append('relativePath', relativePath)
    }
    try {
      await axios.post(`${serverUrl}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      fetchFiles()
      setShowUpload(false)
    } catch (err) {
      console.error('上传失败:', err)
      throw err
    }
  }, [fetchFiles, serverUrl])

  const handleDelete = useCallback(
    async (name) => {
      if (!window.confirm(`确定要删除 "${name}" 吗？`)) return
      try {
        await axios.delete(`${serverUrl}/api/files?path=${encodeURIComponent(name)}`)
        if (selectedFile === name) {
          setSelectedFile(null)
          setVersions([])
        }
        fetchFiles()
      } catch (err) {
        console.error('删除失败:', err)
      }
    },
    [fetchFiles, selectedFile, serverUrl]
  )

  const handleVersionDownload = useCallback((versionId) => {
    window.open(
      `${serverUrl}/api/versions/download?path=${encodeURIComponent(selectedFile)}&versionId=${encodeURIComponent(versionId)}`,
      '_blank'
    )
  }, [selectedFile, serverUrl])

  const handleRestore = useCallback(async (versionId) => {
    try {
      const res = await axios.get(
        `${serverUrl}/api/versions/download?path=${encodeURIComponent(selectedFile)}&versionId=${encodeURIComponent(versionId)}`,
        { responseType: 'blob' }
      )
      const blob = res.data
      const file = new File([blob], selectedFile.split('/').pop(), {
        type: blob.type || 'application/octet-stream',
      })
      const formData = new FormData()
      formData.append('files', file)
      const dir = selectedFile.includes('/')
        ? selectedFile.substring(0, selectedFile.lastIndexOf('/'))
        : ''
      if (dir) {
        formData.append('relativePath', dir)
      }
      await axios.post(`${serverUrl}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      fetchFiles()
      fetchVersions(selectedFile)
    } catch (err) {
      console.error('恢复版本失败:', err)
    }
  }, [selectedFile, fetchFiles, fetchVersions, serverUrl])

  const handleServerUrlChange = useCallback((url) => {
    setServerUrl(url)
    localStorage.setItem('syncServerUrl', url)
  }, [])

  // 选择本地同步目录
  const handlePickSyncDir = useCallback(async () => {
    const picked = await pickSyncDir()
    if (picked && files.length > 0) {
      initialSyncDoneRef.current = false // 重置，触发一次全量同步
      compareAndSyncAll(files)
    }
  }, [pickSyncDir, files, compareAndSyncAll])

  // 手动全量同步
  const handleFullSync = useCallback(() => {
    if (files.length > 0) {
      compareAndSyncAll(files)
    }
  }, [files, compareAndSyncAll])

  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      {/* Header */}
      <header className="bg-zinc-950 border-b border-zinc-800 px-6 py-3 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <FolderSync className="w-6 h-6 text-zinc-300" />
          <div>
            <span className="text-zinc-300 font-bold text-lg">SyncHub</span>
            <span className="text-zinc-500 text-xs ml-2 hidden sm:inline">局域网文件同步</span>
          </div>
        </div>

        {/* Connection indicator */}
        <div className="flex items-center gap-2 ml-4">
          <div
            className={`h-2 w-2 rounded-full ${
              connectionStatus === 'connected'
                ? 'bg-green-500 animate-pulse-glow'
                : connectionStatus === 'connecting'
                ? 'bg-amber-500'
                : 'bg-red-500'
            }`}
          />
          <span className="text-zinc-400 text-sm">
            {connectionStatus === 'connected'
              ? '已连接'
              : connectionStatus === 'connecting'
              ? '连接中...'
              : '未连接'}
          </span>
        </div>

        {/* 本地同步目录 */}
        <div className="flex items-center gap-2 ml-2">
          {syncDirName ? (
            <>
              <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5">
                <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-zinc-300 text-sm max-w-[120px] truncate">{syncDirName}</span>
                {isSyncing ? (
                  <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                )}
              </div>
              {/* 同步进度 */}
              {isSyncing && syncProgress.total > 0 && (
                <span className="text-zinc-500 text-xs">
                  {syncProgress.current}/{syncProgress.total}
                </span>
              )}
              {/* 手动同步按钮 */}
              <button
                onClick={handleFullSync}
                disabled={isSyncing}
                className="text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-30"
                title="全部同步"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
              {/* 取消绑定 */}
              <button
                onClick={clearSyncDir}
                className="text-zinc-500 hover:text-red-400 transition-colors"
                title="取消绑定"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={handlePickSyncDir}
              className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-dashed border-zinc-700 hover:border-zinc-500 rounded-lg px-3 py-1.5 text-sm transition-all"
              title="选择本地同步目录，服务器文件将自动同步到此目录"
            >
              <FolderDown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">绑定本地目录</span>
            </button>
          )}
        </div>

        <div className="flex-1" />

        {/* Server URL input */}
        <input
          type="text"
          defaultValue={serverUrl}
          placeholder="服务器地址"
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-300 w-64 outline-none focus:border-zinc-600 transition-colors"
          onBlur={(e) => {
            const val = e.target.value.trim()
            if (val) handleServerUrlChange(val)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const val = e.target.value.trim()
              if (val) handleServerUrlChange(val)
              e.target.blur()
            }
          }}
        />

        {/* Upload button */}
        <button
          onClick={() => setShowUpload(true)}
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg px-4 py-2 flex items-center gap-2 text-sm transition-colors"
        >
          <Upload className="w-4 h-4" />
          上传
        </button>
      </header>

      {/* Main body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: FileTree */}
        <FileTree
          files={files}
          selectedFile={selectedFile}
          onFileSelect={handleSelectFile}
          onDownload={handleDownload}
        />

        {/* Right: FileList + VersionHistory */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <FileList
            files={files}
            selectedFile={selectedFile}
            onFileSelect={handleSelectFile}
            onDownload={handleDownload}
            onDelete={handleDelete}
            onRefresh={fetchFiles}
            isLoading={isLoading}
          />

          {selectedFile && (
            <VersionHistory
              versions={versions}
              selectedFile={selectedFile}
              onDownload={handleVersionDownload}
              onRestore={handleRestore}
            />
          )}
        </div>
      </div>

      {/* Upload dialog */}
      <UploadDialog
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        onUpload={handleUpload}
      />
    </div>
  )
}
