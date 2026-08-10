import { useState, useRef, useEffect } from 'react'
import { X, UploadCloud, File, Trash2 } from 'lucide-react'

function formatSize(bytes) {
  if (bytes == null) return '—'
  const n = Number(bytes)
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export default function UploadDialog({ isOpen, onClose, onUpload }) {
  const [selectedFiles, setSelectedFiles] = useState([])
  const [relativePath, setRelativePath] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)
  const dialogRef = useRef(null)

  useEffect(() => {
    if (!isOpen) {
      setSelectedFiles([])
      setRelativePath('')
      setError(null)
      setIsUploading(false)
    }
  }, [isOpen])

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setSelectedFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size))
      const newFiles = files.filter((f) => !existing.has(f.name + f.size))
      return [...prev, ...newFiles]
    })
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = (idx) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files || [])
    if (files.length === 0) return

    setSelectedFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size))
      const newFiles = files.filter((f) => !existing.has(f.name + f.size))
      return [...prev, ...newFiles]
    })
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return
    setIsUploading(true)
    setError(null)
    try {
      await onUpload(selectedFiles, relativePath)
    } catch (err) {
      setError(err.message || '上传失败，请重试')
    } finally {
      setIsUploading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-[480px] max-h-[80vh] flex flex-col animate-slide-left"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center shrink-0">
          <h2 className="text-zinc-200 font-medium">上传文件</h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4 overflow-y-auto">
          {/* Drop zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragOver
                ? 'border-zinc-400 bg-zinc-800/30'
                : 'border-zinc-700 hover:border-zinc-500'
            }`}
          >
            <UploadCloud className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">拖拽文件到此处或点击选择</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Selected files */}
          {selectedFiles.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {selectedFiles.map((file, idx) => (
                <div
                  key={`${file.name}-${file.size}-${idx}`}
                  className="flex items-center gap-2 px-3 py-2 rounded bg-zinc-800/50 group"
                >
                  <File className="w-4 h-4 text-zinc-500 shrink-0" />
                  <span className="text-zinc-300 text-sm truncate flex-1">
                    {file.name}
                  </span>
                  <span className="text-zinc-500 text-xs shrink-0">
                    {formatSize(file.size)}
                  </span>
                  <button
                    onClick={() => removeFile(idx)}
                    className="p-0.5 rounded text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Relative path */}
          <div>
            <label className="text-zinc-500 text-xs block mb-1.5">
              子目录 (可选)
            </label>
            <input
              type="text"
              value={relativePath}
              onChange={(e) => setRelativePath(e.target.value)}
              placeholder="例如: documents/projects"
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 w-full outline-none focus:border-zinc-500 transition-colors placeholder-zinc-500"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            disabled={isUploading}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg px-4 py-2 text-sm transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || isUploading}
            className="bg-zinc-200 hover:bg-white text-zinc-900 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {isUploading ? '上传中...' : '上传'}
          </button>
        </div>
      </div>
    </div>
  )
}
