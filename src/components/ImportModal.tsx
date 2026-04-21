import { useState } from 'react'
import { parseFrontmatter } from '../lib/wikilinks'
import { useStore } from '../store/useStore'

interface ImportModalProps {
  onClose: () => void
}

interface ParsedNote {
  title: string
  content: string
  tags: string[]
  folderPath: string[]
}

export default function ImportModal({ onClose }: ImportModalProps) {
  const [status, setStatus] = useState<'idle' | 'parsing' | 'importing' | 'done'>('idle')
  const [parsed, setParsed] = useState<ParsedNote[]>([])
  const [progress, setProgress] = useState(0)
  const { createFolder, bulkImportNotes, folders } = useStore()

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.name.endsWith('.md'))
    if (!files.length) return
    setStatus('parsing')

    const result: ParsedNote[] = []
    for (const file of files) {
      const raw = await file.text()
      const { body, data } = parseFrontmatter(raw)
      const rawTags = data.tags
      const tags = Array.isArray(rawTags)
        ? rawTags.map(String)
        : typeof rawTags === 'string'
        ? rawTags.split(',').map((t) => t.trim()).filter(Boolean)
        : []

      // Derive folder path from file.webkitRelativePath (skip vault root + filename)
      const parts = (file as File & { webkitRelativePath: string }).webkitRelativePath.split('/')
      const folderPath = parts.slice(1, -1)

      result.push({
        title: file.name.replace(/\.md$/, ''),
        content: body.trim(),
        tags,
        folderPath,
      })
    }
    setParsed(result)
    setStatus('idle')
  }

  const doImport = async () => {
    setStatus('importing')
    setProgress(5)

    // ── Step 1: ensure all folders exist and collect their IDs ────────────────
    // folderCache key: "parentId/segName" → folder UUID
    const folderCache = new Map<string, string>()
    for (const f of folders) folderCache.set(`root/${f.name}`, f.id)

    const uniquePaths = [
      ...new Set(parsed.flatMap((n) => n.folderPath.map((_, i) => n.folderPath.slice(0, i + 1).join('/'))))
    ].sort((a, b) => a.split('/').length - b.split('/').length) // shallow first

    for (const path of uniquePaths) {
      const segs = path.split('/')
      const seg = segs[segs.length - 1]
      const parentSeg = segs.slice(0, -1).join('/')
      const parentId = parentSeg ? folderCache.get(parentSeg) : undefined
      const cacheKey = parentSeg ? `${parentSeg}/${seg}` : `root/${seg}`

      if (!folderCache.has(cacheKey)) {
        const newId = await createFolder(seg, parentId)
        folderCache.set(cacheKey, newId)
      }
    }
    setProgress(20)

    // ── Step 2: map each parsed note to its folder_id ────────────────────────
    const items = parsed.map((note) => {
      let folder_id: string | null = null
      if (note.folderPath.length > 0) {
        const cacheKey = note.folderPath.length === 1
          ? `root/${note.folderPath[0]}`
          : note.folderPath.join('/')
        folder_id = folderCache.get(cacheKey) ?? null
      }
      return { title: note.title, content: note.content, tags: note.tags, folder_id }
    })

    // ── Step 3: batch insert all notes with content in one go ────────────────
    await bulkImportNotes(items)
    setProgress(100)
    setStatus('done')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-[480px] rounded-xl p-6 shadow-2xl"
        style={{ background: '#141416', border: '1px solid #3a3a48' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-text-primary">Import Obsidian Vault</h2>
          <button className="text-text-muted hover:text-text-primary text-xl leading-none" onClick={onClose}>×</button>
        </div>

        {status === 'idle' && parsed.length === 0 && (
          <div>
            <p className="text-sm text-text-secondary mb-4">
              Select your Obsidian vault folder. All <code className="text-accent-purple">.md</code> files will be imported with their folder structure, tags, and content preserved.
            </p>
            <label
              className="flex flex-col items-center justify-center w-full h-32 rounded-lg cursor-pointer transition-colors"
              style={{ border: '2px dashed #3a3a48', background: '#1a1a1f' }}
            >
              <span className="text-3xl mb-2 opacity-40">⬚</span>
              <span className="text-sm text-text-muted">Click to select vault folder</span>
              <input
                type="file"
                className="hidden"
                // @ts-expect-error non-standard attribute
                webkitdirectory=""
                multiple
                onChange={handleFileSelect}
              />
            </label>
          </div>
        )}

        {status === 'parsing' && (
          <div className="text-center py-8 text-text-muted">
            <div className="animate-spin text-2xl mb-3">◌</div>
            Scanning files…
          </div>
        )}

        {status === 'idle' && parsed.length > 0 && (
          <div>
            <div className="mb-4 p-3 rounded-lg" style={{ background: 'rgba(124,106,247,0.08)', border: '1px solid rgba(124,106,247,0.2)' }}>
              <div className="text-sm text-text-primary font-medium">{parsed.length} notes found</div>
              <div className="text-xs text-text-muted mt-1">
                {[...new Set(parsed.flatMap((n) => n.tags))].length} unique tags •{' '}
                {[...new Set(parsed.flatMap((n) => n.folderPath[0]).filter(Boolean))].length} top-level folders
              </div>
            </div>
            <div className="max-h-40 overflow-y-auto mb-4 space-y-0.5">
              {parsed.slice(0, 20).map((n) => (
                <div key={n.title} className="text-xs text-text-muted flex items-center gap-2 px-1">
                  <span className="text-accent-purple opacity-60">✦</span>
                  <span className="truncate">
                    {n.folderPath.length > 0 ? n.folderPath.join('/') + ' / ' : ''}{n.title}
                  </span>
                </div>
              ))}
              {parsed.length > 20 && (
                <div className="text-xs text-text-muted px-1">…and {parsed.length - 20} more</div>
              )}
            </div>
            <button
              className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-colors"
              style={{ background: '#7c6af7' }}
              onClick={doImport}
            >
              Import {parsed.length} notes
            </button>
          </div>
        )}

        {status === 'importing' && (
          <div className="py-6">
            <div className="flex justify-between text-sm text-text-secondary mb-2">
              <span>Importing…</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#2a2a35' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${progress}%`, background: '#7c6af7' }}
              />
            </div>
          </div>
        )}

        {status === 'done' && (
          <div className="text-center py-8">
            <div className="text-3xl mb-3">✓</div>
            <div className="text-text-primary font-medium">{parsed.length} notes imported</div>
            <div className="text-sm text-text-muted mt-1">Your vault is now in Memory Grid</div>
            <button
              className="mt-4 px-6 py-2 rounded-lg text-sm text-white"
              style={{ background: '#7c6af7' }}
              onClick={onClose}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
