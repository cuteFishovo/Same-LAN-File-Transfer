import { History, Download, RotateCcw } from 'lucide-react'

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
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleString('zh-CN')
}

export default function VersionHistory({ versions, selectedFile, onDownload, onRestore }) {
  if (!versions || versions.length === 0) {
    return (
      <div className="border-t border-zinc-800 bg-zinc-950/50">
        <div className="px-6 py-3 flex items-center gap-2">
          <History className="w-4 h-4 text-zinc-500" />
          <span className="text-zinc-400 text-sm font-medium">版本历史</span>
          <span className="text-zinc-300 text-sm ml-2 truncate">{selectedFile}</span>
        </div>
        <div className="px-6 pb-4">
          <p className="text-zinc-500 text-sm text-center py-4">暂无版本历史</p>
        </div>
      </div>
    )
  }

  return (
    <div className="border-t border-zinc-800 bg-zinc-950/50 animate-slide-down">
      <div className="px-6 py-3 flex items-center gap-2 shrink-0">
        <History className="w-4 h-4 text-zinc-500" />
        <span className="text-zinc-400 text-sm font-medium">版本历史</span>
        <span className="text-zinc-300 text-sm ml-2 truncate max-w-xs">{selectedFile}</span>
      </div>
      <div className="px-6 pb-4 max-h-48 overflow-y-auto">
        <div className="relative">
          {versions.map((v, idx) => {
            const isCurrent = v.current === true || idx === 0
            return (
              <div key={v.id || idx} className="flex items-center gap-3 py-2">
                {/* Timeline dot */}
                <div className="flex flex-col items-center shrink-0">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isCurrent ? 'bg-zinc-400' : 'bg-zinc-700'
                    }`}
                  />
                  {idx < versions.length - 1 && (
                    <div className="w-px flex-1 min-h-[16px] bg-zinc-800" />
                  )}
                </div>

                {/* Version info */}
                <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                  <span className="bg-zinc-800 text-zinc-400 text-xs rounded px-2 py-0.5 font-mono truncate max-w-[120px]">
                    {v.id || `v${idx + 1}`}
                  </span>
                  <span className="text-zinc-500 text-xs">{formatTime(v.timestamp || v.created)}</span>
                  <span className="text-zinc-500 text-xs">{formatSize(v.size)}</span>
                  {isCurrent && (
                    <span className="bg-zinc-400/10 text-zinc-400 text-xs rounded px-1.5 py-0.5">
                      当前
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onDownload(v.id)}
                    className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700/50 transition-colors"
                    title="下载此版本"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  {!isCurrent && (
                    <button
                      onClick={() => onRestore(v.id)}
                      className="p-1 rounded text-zinc-500 hover:text-amber-400 hover:bg-zinc-700/50 transition-colors"
                      title="恢复此版本"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
