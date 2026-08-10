import { useState, useMemo } from 'react'
import { File, Folder, FolderOpen, Search, ChevronRight, ChevronDown } from 'lucide-react'

export default function FileTree({ files, selectedFile, onFileSelect, onDownload }) {
  const [search, setSearch] = useState('')
  const [expandedDirs, setExpandedDirs] = useState({})

  const treeData = useMemo(() => {
    const dirs = {}
    const rootFiles = []

    files.forEach((f) => {
      const name = f.name
      if (!name.includes('/')) {
        rootFiles.push(name)
      } else {
        const parts = name.split('/')
        const dir = parts.slice(0, -1).join('/')
        const fileName = parts[parts.length - 1]
        if (!dirs[dir]) {
          dirs[dir] = []
        }
        dirs[dir].push(name)
      }
    })

    return { dirs, rootFiles }
  }, [files])

  const filteredDirs = useMemo(() => {
    if (!search) return Object.keys(treeData.dirs).sort()
    const q = search.toLowerCase()
    return Object.keys(treeData.dirs)
      .filter((d) => d.toLowerCase().includes(q) || treeData.dirs[d].some((f) => f.toLowerCase().includes(q)))
      .sort()
  }, [treeData.dirs, search])

  const filteredRootFiles = useMemo(() => {
    if (!search) return treeData.rootFiles
    const q = search.toLowerCase()
    return treeData.rootFiles.filter((f) => f.toLowerCase().includes(q))
  }, [treeData.rootFiles, search])

  const toggleDir = (dir) => {
    setExpandedDirs((prev) => ({ ...prev, [dir]: !prev[dir] }))
  }

  return (
    <div className="bg-zinc-950 border-r border-zinc-800 w-72 flex flex-col h-full shrink-0">
      {/* Search */}
      <div className="px-3 pt-3">
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 flex items-center gap-2 px-3 py-2">
          <Search className="w-4 h-4 text-zinc-500 shrink-0" />
          <input
            type="text"
            placeholder="搜索文件..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm text-zinc-300 placeholder-zinc-500 outline-none w-full"
          />
        </div>
      </div>

      {/* Tree content */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <FolderOpen className="w-10 h-10 text-zinc-700 mb-3" />
            <p className="text-zinc-500 text-sm">暂无文件</p>
          </div>
        ) : (
          <>
            {/* Root files */}
            {filteredRootFiles.map((name, idx) => (
              <div
                key={name}
                onClick={() => onFileSelect(name)}
                onDoubleClick={() => onDownload(name)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer text-sm transition-colors stagger-item ${
                  selectedFile === name
                    ? 'bg-zinc-800/60 text-zinc-200'
                    : 'text-zinc-400 hover:bg-zinc-800/30'
                }`}
              >
                <File className="w-4 h-4 shrink-0" />
                <span className="truncate">{name}</span>
              </div>
            ))}

            {/* Directories */}
            {filteredDirs.map((dir) => {
              const isExpanded = expandedDirs[dir] || !!search
              const dirFiles = treeData.dirs[dir] || []
              return (
                <div key={dir} className="stagger-item">
                  {/* Directory header */}
                  <div
                    onClick={() => toggleDir(dir)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer text-sm text-zinc-400 hover:bg-zinc-800/30 transition-colors"
                  >
                    <span className="text-zinc-600">
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </span>
                    {isExpanded ? (
                      <FolderOpen className="w-4 h-4 text-zinc-500 shrink-0" />
                    ) : (
                      <Folder className="w-4 h-4 text-zinc-500 shrink-0" />
                    )}
                    <span className="truncate">{dir}</span>
                    <span className="text-zinc-600 text-xs ml-auto">{dirFiles.length}</span>
                  </div>

                  {/* Directory children */}
                  {isExpanded && (
                    <div className="ml-4 border-l border-zinc-800/50">
                      {dirFiles.map((name) => {
                        const baseName = name.split('/').pop()
                        return (
                          <div
                            key={name}
                            onClick={(e) => {
                              e.stopPropagation()
                              onFileSelect(name)
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation()
                              onDownload(name)
                            }}
                            className={`flex items-center gap-2 pl-5 pr-3 py-1.5 rounded cursor-pointer text-sm transition-colors ${
                              selectedFile === name
                                ? 'bg-zinc-800/60 text-zinc-200'
                                : 'text-zinc-400 hover:bg-zinc-800/30'
                            }`}
                          >
                            <File className="w-4 h-4 shrink-0" />
                            <span className="truncate">{baseName}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
