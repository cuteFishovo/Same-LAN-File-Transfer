import { useState, useMemo } from 'react'
import { File, Download, Trash2, RefreshCw, FolderOpen, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

function formatSize(bytes) {
  if (bytes == null) return '—'
  const n = Number(bytes)
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatTime(isoString) {
  if (!isoString) return '—'
  const now = Date.now()
  const date = new Date(isoString).getTime()
  if (isNaN(date)) return '—'
  const diff = now - date
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 30) return `${days}天前`
  return new Date(isoString).toLocaleDateString('zh-CN')
}

export default function FileList({ files, selectedFile, onFileSelect, onDownload, onDelete, onRefresh, isLoading }) {
  const [sortBy, setSortBy] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')

  const sortedFiles = useMemo(() => {
    const sorted = [...files].sort((a, b) => {
      let valA, valB
      switch (sortBy) {
        case 'name':
          valA = (a.name || '').toLowerCase()
          valB = (b.name || '').toLowerCase()
          break
        case 'size':
          valA = a.size ?? 0
          valB = b.size ?? 0
          break
        case 'modified':
          valA = a.modified ? new Date(a.modified).getTime() : 0
          valB = b.modified ? new Date(b.modified).getTime() : 0
          break
        default:
          return 0
      }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  }, [files, sortBy, sortOrder])

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(col)
      setSortOrder('asc')
    }
  }

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <ArrowUpDown className="w-3 h-3 text-zinc-600" />
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-zinc-400" />
    ) : (
      <ArrowDown className="w-3 h-3 text-zinc-400" />
    )
  }

  // Loading shimmer
  if (isLoading && files.length === 0) {
    return (
      <div className="flex-1 flex flex-col h-full">
        <div className="px-6 py-3 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-zinc-300 font-medium">文件列表</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 text-zinc-600 animate-spin" />
            <span className="text-zinc-500 text-sm">加载中...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header bar */}
      <div className="px-6 py-3 border-b border-zinc-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-zinc-300 font-medium">文件列表</span>
          <span className="bg-zinc-800 text-zinc-400 text-xs rounded-full px-2 py-0.5">
            {files.length}
          </span>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
          title="刷新"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Empty state */}
      {files.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 stagger-item">
          <FolderOpen className="w-16 h-16 text-zinc-700" />
          <h3 className="text-zinc-400 text-lg font-medium">暂无文件</h3>
          <p className="text-zinc-500 text-sm">点击上方上传按钮开始同步</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-zinc-950">
              <tr className="bg-zinc-900/50 text-zinc-500 text-xs uppercase tracking-wider">
                <th
                  className="text-left px-6 py-3 cursor-pointer hover:text-zinc-300 transition-colors font-medium"
                  onClick={() => handleSort('name')}
                >
                  <span className="flex items-center gap-1">
                    文件名 <SortIcon col="name" />
                  </span>
                </th>
                <th
                  className="text-left px-4 py-3 w-24 cursor-pointer hover:text-zinc-300 transition-colors font-medium"
                  onClick={() => handleSort('size')}
                >
                  <span className="flex items-center gap-1">
                    大小 <SortIcon col="size" />
                  </span>
                </th>
                <th
                  className="text-left px-4 py-3 w-36 cursor-pointer hover:text-zinc-300 transition-colors font-medium"
                  onClick={() => handleSort('modified')}
                >
                  <span className="flex items-center gap-1">
                    修改时间 <SortIcon col="modified" />
                  </span>
                </th>
                <th className="text-right px-6 py-3 w-24 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {sortedFiles.map((file, idx) => (
                <tr
                  key={file.name}
                  onClick={() => onFileSelect(file.name)}
                  className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors cursor-pointer stagger-item ${
                    selectedFile === file.name
                      ? 'bg-zinc-800/50 border-l-2 border-l-zinc-400'
                      : 'border-l-2 border-l-transparent'
                  }`}
                >
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <File className="w-4 h-4 text-zinc-500 shrink-0" />
                      <span className="text-zinc-300 text-sm truncate max-w-[300px]">
                        {file.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-sm">
                    {formatSize(file.size)}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-sm">
                    {formatTime(file.modified)}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDownload(file.name)
                        }}
                        className="p-1.5 rounded text-zinc-600 hover:text-zinc-200 hover:bg-zinc-700/50 transition-colors opacity-0 group-hover:opacity-100"
                        style={{ opacity: 0 }}
                        onFocus={(e) => (e.currentTarget.style.opacity = 1)}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = 0)}
                        title="下载"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(file.name)
                        }}
                        className="p-1.5 rounded text-zinc-600 hover:text-red-400 hover:bg-zinc-700/50 transition-colors"
                        style={{ opacity: 0 }}
                        onFocus={(e) => (e.currentTarget.style.opacity = 1)}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = 0)}
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
