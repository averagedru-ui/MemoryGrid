import { useState, useEffect, useRef, forwardRef } from 'react'
import { useStore } from '../store/useStore'
import type { Folder, Note } from '../types'

// ── Context menu ───────────────────────────────────────────────────────────────
interface CtxMenu {
  x: number
  y: number
  note: Note
}

export default function Sidebar() {
  const {
    notes, folders, activeNoteId, sidebarView,
    createNote, createFolder, deleteNote, deleteNotes, setActiveNote,
    setSidebarView, setMainView, updateNote,
  } = useStore()

  const [search, setSearch] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const ctxRef = useRef<HTMLDivElement>(null)

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const clearSelection = () => setSelected(new Set())

  const handleBulkDelete = async () => {
    const count = selected.size
    if (!confirm(`Delete ${count} note${count !== 1 ? 's' : ''}? This cannot be undone.`)) return
    await deleteNotes([...selected])
    clearSelection()
  }

  // Close context menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) {
        setCtxMenu(null)
      }
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [])

  const filteredNotes = search
    ? notes.filter(
        (n) =>
          n.title.toLowerCase().includes(search.toLowerCase()) ||
          n.content.toLowerCase().includes(search.toLowerCase())
      )
    : notes

  const rootNotes = filteredNotes.filter((n) => !n.folder_id)
  const rootFolders = folders.filter((f) => !f.parent_id)
  const allTags = [...new Set(notes.flatMap((n) => n.tags))].sort()

  return (
    <div className="flex flex-col h-full" style={{ background: '#141416' }}>
      <div className="px-4 py-3 flex items-center gap-2 border-b border-border-subtle flex-shrink-0">
        <span className="text-accent-purple text-lg">✦</span>
        <span className="font-semibold text-sm text-text-primary">Memory Grid</span>
      </div>

      <div className="flex border-b border-border-subtle flex-shrink-0">
        {([
          { view: 'files', icon: '⬚', label: 'Files' },
          { view: 'search', icon: '⌕', label: 'Search' },
          { view: 'tags', icon: '#', label: 'Tags' },
          { view: 'backlinks', icon: '↩', label: 'Backlinks' },
        ] as const).map(({ view, icon, label }) => (
          <button
            key={view}
            className={`flex-1 py-2 text-sm transition-colors ${
              sidebarView === view
                ? 'text-accent-purple border-b-2 border-accent-purple'
                : 'text-text-muted hover:text-text-secondary'
            }`}
            title={label}
            onClick={() => setSidebarView(view)}
          >
            {icon}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 relative">
        {sidebarView === 'files' && (
          <div className="p-2 pb-0">
            <div className="flex gap-1 mb-2">
              <button
                className="flex-1 text-xs py-1 rounded transition-colors text-text-muted hover:text-text-primary hover:bg-bg-hover"
                onClick={() => createNote('Untitled')}
              >
                + Note
              </button>
              <button
                className="flex-1 text-xs py-1 rounded transition-colors text-text-muted hover:text-text-primary hover:bg-bg-hover"
                onClick={() => {
                  const name = prompt('Folder name:')
                  if (name) createFolder(name)
                }}
              >
                + Folder
              </button>
            </div>

            {rootFolders.map((folder) => (
              <FolderItem
                key={folder.id}
                folder={folder}
                notes={notes}
                activeNoteId={activeNoteId}
                selected={selected}
                expanded={expandedFolders.has(folder.id)}
                onToggle={toggleFolder}
                onNoteClick={setActiveNote}
                onNoteSelect={toggleSelect}
                onNoteContext={(note, x, y) => setCtxMenu({ x, y, note })}
              />
            ))}

            {rootNotes.map((note) => (
              <NoteItem
                key={note.id}
                note={note}
                active={activeNoteId === note.id}
                selected={selected.has(note.id)}
                onClick={() => setActiveNote(note.id)}
                onSelect={() => toggleSelect(note.id)}
                onContext={(x, y) => setCtxMenu({ x, y, note })}
              />
            ))}

            {/* Bulk-delete bar — sticks to bottom of notes list */}
            {selected.size > 0 && (
              <div
                className="sticky bottom-0 mt-2 -mx-2 px-3 py-2 flex items-center gap-2"
                style={{ background: 'rgba(20,20,22,0.96)', borderTop: '1px solid #2a2a35' }}
              >
                <span className="text-xs text-text-muted flex-1">{selected.size} selected</span>
                <button
                  className="text-xs px-2 py-0.5 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                  onClick={clearSelection}
                >
                  Clear
                </button>
                <button
                  className="text-xs px-2 py-0.5 rounded text-red-400 hover:bg-bg-hover transition-colors"
                  onClick={handleBulkDelete}
                >
                  Delete {selected.size}
                </button>
              </div>
            )}
          </div>
        )}

        {sidebarView === 'search' && (
          <div className="p-2">
            <input
              className="w-full px-3 py-1.5 rounded text-sm bg-bg-tertiary border border-border-subtle text-text-primary placeholder-text-muted outline-none focus:border-accent-purple transition-colors"
              placeholder="Search notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            <div className="mt-2 space-y-0.5">
              {filteredNotes.map((note) => (
                <NoteItem
                  key={note.id}
                  note={note}
                  active={activeNoteId === note.id}
                  selected={selected.has(note.id)}
                  onClick={() => setActiveNote(note.id)}
                  onSelect={() => toggleSelect(note.id)}
                  onContext={(x, y) => setCtxMenu({ x, y, note })}
                />
              ))}
              {search && filteredNotes.length === 0 && (
                <div className="text-xs text-text-muted p-2">No results</div>
              )}
            </div>
          </div>
        )}

        {sidebarView === 'tags' && (
          <div className="p-2">
            {allTags.length === 0 && (
              <div className="text-xs text-text-muted p-2">No tags yet</div>
            )}
            {allTags.map((tag) => (
              <button
                key={tag}
                className="w-full text-left px-2 py-1 rounded text-sm text-accent-purple hover:bg-bg-hover transition-colors"
                onClick={() => { setSidebarView('search'); setSearch(tag) }}
              >
                #{tag}
                <span className="ml-1 text-text-muted text-xs">
                  ({notes.filter((n) => n.tags.includes(tag)).length})
                </span>
              </button>
            ))}
          </div>
        )}

        {sidebarView === 'backlinks' && <BacklinksPanel />}

        {/* Context menu */}
        {ctxMenu && (
          <ContextMenu
            ref={ctxRef}
            x={ctxMenu.x}
            y={ctxMenu.y}
            note={ctxMenu.note}
            folders={folders}
            onMove={(folderId) => {
              updateNote(ctxMenu.note.id, { folder_id: folderId })
              setCtxMenu(null)
            }}
            onDelete={() => {
              if (confirm(`Delete "${ctxMenu.note.title || 'Untitled'}"?`)) {
                deleteNote(ctxMenu.note.id)
              }
              setCtxMenu(null)
            }}
            onClose={() => setCtxMenu(null)}
          />
        )}
      </div>

      <div className="flex border-t border-border-subtle flex-shrink-0">
        {([
          { view: 'editor', icon: '✎', label: 'Editor' },
          { view: 'graph', icon: '◎', label: '2D Graph' },
          { view: 'galaxy', icon: '✦', label: 'Galaxy' },
        ] as const).map(({ view, icon, label }) => (
          <button
            key={view}
            className="flex-1 py-2 text-xs text-text-muted hover:text-text-primary transition-colors"
            title={label}
            onClick={() => setMainView(view)}
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Context menu component ─────────────────────────────────────────────────────
const ContextMenu = forwardRef<HTMLDivElement, {
  x: number; y: number; note: Note; folders: Folder[]
  onMove: (folderId: string | null) => void
  onDelete: () => void
  onClose: () => void
}>(({ x, y, note, folders, onMove, onDelete }, ref) => {
  const [showFolders, setShowFolders] = useState(false)

  return (
    <div
      ref={ref}
      className="fixed z-50 rounded-lg overflow-hidden shadow-xl py-1"
      style={{
        left: x, top: y,
        background: '#1a1a1f',
        border: '1px solid #3a3a48',
        minWidth: 160,
      }}
    >
      {/* Move to folder */}
      <button
        className="w-full flex items-center justify-between px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
        onClick={() => setShowFolders(!showFolders)}
      >
        <span>Move to folder</span>
        <span className="opacity-50 text-xs">{showFolders ? '▴' : '▸'}</span>
      </button>

      {showFolders && (
        <div className="border-t border-border-subtle">
          {note.folder_id && (
            <button
              className="w-full text-left px-4 py-1.5 text-xs text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors"
              onClick={() => onMove(null)}
            >
              ✕ Remove from folder
            </button>
          )}
          {folders.map((f) => (
            <button
              key={f.id}
              className={`w-full text-left px-4 py-1.5 text-xs transition-colors hover:bg-bg-hover ${
                note.folder_id === f.id ? 'text-accent-purple' : 'text-text-secondary hover:text-text-primary'
              }`}
              onClick={() => onMove(f.id)}
            >
              {note.folder_id === f.id ? '✓ ' : ''}{f.name}
            </button>
          ))}
          {folders.length === 0 && (
            <div className="px-4 py-1.5 text-xs text-text-muted">No folders yet</div>
          )}
        </div>
      )}

      <div className="border-t border-border-subtle mt-1 pt-1">
        <button
          className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-bg-hover transition-colors"
          onClick={onDelete}
        >
          Delete note
        </button>
      </div>
    </div>
  )
})
ContextMenu.displayName = 'ContextMenu'

// ── Folder item ────────────────────────────────────────────────────────────────
function FolderItem({
  folder, notes, activeNoteId, selected, expanded,
  onToggle, onNoteClick, onNoteSelect, onNoteContext,
}: {
  folder: Folder; notes: Note[]; activeNoteId: string | null
  selected: Set<string>
  expanded: boolean
  onToggle: (id: string) => void
  onNoteClick: (id: string) => void
  onNoteSelect: (id: string) => void
  onNoteContext: (note: Note, x: number, y: number) => void
}) {
  const { deleteFolder } = useStore()
  const [hovered, setHovered] = useState(false)
  const folderNotes = notes.filter((n) => n.folder_id === folder.id)

  return (
    <div className="mb-0.5">
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded text-sm text-text-secondary hover:bg-bg-hover transition-colors"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <button className="flex items-center gap-1.5 flex-1 min-w-0 text-left" onClick={() => onToggle(folder.id)}>
          <span className="text-xs opacity-60 flex-shrink-0">{expanded ? '▾' : '▸'}</span>
          <span className="opacity-60 text-xs flex-shrink-0">⬚</span>
          <span className="truncate">{folder.name}</span>
          <span className="ml-1 text-xs text-text-muted flex-shrink-0">{folderNotes.length}</span>
        </button>
        {hovered && (
          <button
            className="text-text-muted hover:text-red-400 transition-colors text-xs px-1 flex-shrink-0"
            onClick={() => {
              if (confirm(`Delete folder "${folder.name}"? Notes will move to root.`)) {
                deleteFolder(folder.id)
              }
            }}
          >
            ✕
          </button>
        )}
      </div>
      {expanded && (
        <div className="ml-4">
          {folderNotes.map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              active={activeNoteId === note.id}
              selected={selected.has(note.id)}
              onClick={() => onNoteClick(note.id)}
              onSelect={() => onNoteSelect(note.id)}
              onContext={(x, y) => onNoteContext(note, x, y)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Note item ──────────────────────────────────────────────────────────────────
function NoteItem({ note, active, selected, onClick, onSelect, onContext }: {
  note: Note; active: boolean; selected: boolean
  onClick: () => void
  onSelect: () => void
  onContext: (x: number, y: number) => void
}) {
  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 rounded text-sm transition-colors cursor-pointer group ${
        active
          ? 'bg-bg-hover text-text-primary'
          : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
      }`}
      style={selected ? {
        background: 'rgba(124,106,247,0.12)',
        outline: '1px solid rgba(124,106,247,0.25)',
        outlineOffset: '-1px',
      } : {}}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault()
        onContext(e.clientX, e.clientY)
      }}
    >
      {/* Checkbox — visible on hover or when selected */}
      <button
        className={`flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center text-xs rounded-sm transition-all leading-none ${
          selected
            ? 'text-accent-purple opacity-100'
            : 'opacity-0 group-hover:opacity-40 text-text-muted'
        }`}
        onClick={(e) => { e.stopPropagation(); onSelect() }}
        title="Select"
      >
        {selected ? '✓' : '○'}
      </button>
      <span className="truncate flex-1">{note.title || 'Untitled'}</span>
      <span className="opacity-0 group-hover:opacity-30 text-xs flex-shrink-0 select-none">⋯</span>
    </div>
  )
}

// ── Backlinks panel ────────────────────────────────────────────────────────────
function BacklinksPanel() {
  const { notes, links, activeNoteId, setActiveNote } = useStore()
  if (!activeNoteId) return <div className="text-xs text-text-muted p-3">Open a note to see backlinks</div>

  const backlinks = links
    .filter((l) => l.target === activeNoteId)
    .map((l) => notes.find((n) => n.id === l.source))
    .filter(Boolean) as Note[]

  return (
    <div className="p-2">
      <div className="text-xs text-text-muted px-2 pb-1">
        {backlinks.length} backlink{backlinks.length !== 1 ? 's' : ''}
      </div>
      {backlinks.map((note) => (
        <NoteItem
          key={note.id}
          note={note}
          active={false}
          selected={false}
          onClick={() => setActiveNote(note.id)}
          onSelect={() => {}}
          onContext={() => {}}
        />
      ))}
      {backlinks.length === 0 && (
        <div className="text-xs text-text-muted p-2">No notes link here yet</div>
      )}
    </div>
  )
}
