import { useState } from 'react'
import { useStore } from '../store/useStore'
import type { Folder, Note } from '../types'

export default function Sidebar() {
  const {
    notes, folders, activeNoteId, sidebarView,
    createNote, createFolder, deleteNote, setActiveNote,
    setSidebarView, setMainView, updateNote,
  } = useStore()
  const [search, setSearch] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [dragOverId, setDragOverId] = useState<string | 'root' | null>(null)

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleDrop = (folderId: string | null, e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const noteId = e.dataTransfer.getData('noteId') || e.dataTransfer.getData('text/plain')
    if (noteId) updateNote(noteId, { folder_id: folderId })
    setDragOverId(null)
  }

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

      <div className="flex-1 overflow-y-auto min-h-0">
        {sidebarView === 'files' && (
          <div
            className="p-2"
            onDragOver={(e) => e.preventDefault()}
          >
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
                expanded={expandedFolders.has(folder.id)}
                isDragOver={dragOverId === folder.id}
                onToggle={toggleFolder}
                onNoteClick={setActiveNote}
                onNoteDelete={deleteNote}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverId(folder.id) }}
                onDragLeave={(e) => { if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget as Node)) setDragOverId(null) }}
                onDrop={(e) => handleDrop(folder.id, e)}
              />
            ))}

            {/* Root drop zone */}
            <div
              className="rounded min-h-4 transition-all"
              style={dragOverId === 'root' ? {
                background: 'rgba(124,106,247,0.06)',
                outline: '1px dashed rgba(124,106,247,0.4)',
              } : {}}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverId('root') }}
              onDragLeave={(e) => { if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget as Node)) setDragOverId(null) }}
              onDrop={(e) => handleDrop(null, e)}
            >
              {rootNotes.map((note) => (
                <NoteItem
                  key={note.id}
                  note={note}
                  active={activeNoteId === note.id}
                  onClick={() => setActiveNote(note.id)}
                  onDelete={() => {
                    if (confirm(`Delete "${note.title || 'Untitled'}"?`)) deleteNote(note.id)
                  }}
                />
              ))}
              {dragOverId === 'root' && rootNotes.length === 0 && (
                <div className="text-xs text-text-muted text-center py-2 opacity-50">Drop here to remove from folder</div>
              )}
            </div>
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
                  onClick={() => setActiveNote(note.id)}
                  onDelete={() => {
                    if (confirm(`Delete "${note.title || 'Untitled'}"?`)) deleteNote(note.id)
                  }}
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

function FolderItem({
  folder, notes, activeNoteId, expanded, isDragOver,
  onToggle, onNoteClick, onNoteDelete, onDragOver, onDragLeave, onDrop,
}: {
  folder: Folder
  notes: Note[]
  activeNoteId: string | null
  expanded: boolean
  isDragOver: boolean
  onToggle: (id: string) => void
  onNoteClick: (id: string) => void
  onNoteDelete: (id: string) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
}) {
  const { deleteFolder } = useStore()
  const [hovered, setHovered] = useState(false)
  const folderNotes = notes.filter((n) => n.folder_id === folder.id)

  return (
    <div
      className="rounded mb-0.5 transition-all"
      style={isDragOver ? { background: 'rgba(124,106,247,0.08)', outline: '1px dashed rgba(124,106,247,0.5)' } : {}}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded text-sm text-text-secondary hover:bg-bg-hover transition-colors group"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <button className="flex items-center gap-1.5 flex-1 min-w-0" onClick={() => onToggle(folder.id)}>
          <span className="text-xs opacity-60">{expanded ? '▾' : '▸'}</span>
          <span className="opacity-60 text-xs">⬚</span>
          <span className="truncate">{folder.name}</span>
          <span className="ml-1 text-xs text-text-muted">{folderNotes.length}</span>
        </button>
        {hovered && (
          <button
            className="text-text-muted hover:text-red-400 transition-colors text-xs px-1 flex-shrink-0"
            title="Delete folder"
            onClick={() => {
              if (confirm(`Delete folder "${folder.name}"? Notes inside will be moved to root.`)) {
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
              onClick={() => onNoteClick(note.id)}
              onDelete={() => {
                if (confirm(`Delete "${note.title || 'Untitled'}"?`)) onNoteDelete(note.id)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function NoteItem({
  note, active, onClick, onDelete,
}: {
  note: Note
  active: boolean
  onClick: () => void
  onDelete: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.clearData()
        e.dataTransfer.setData('text/plain', note.id)
        e.dataTransfer.setData('noteId', note.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      className={`flex items-center gap-2 px-2 py-1 rounded text-sm transition-colors select-none ${
        active ? 'bg-bg-hover text-text-primary' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
      }`}
      style={{ cursor: hovered ? 'grab' : 'default' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <span className="opacity-40 text-xs flex-shrink-0">✦</span>
      <span className="truncate flex-1">{note.title || 'Untitled'}</span>
      {hovered && (
        <button
          className="text-text-muted hover:text-red-400 transition-colors text-xs px-1 flex-shrink-0"
          title="Delete note"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
        >
          ✕
        </button>
      )}
    </div>
  )
}

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
          onClick={() => setActiveNote(note.id)}
          onDelete={() => {}}
        />
      ))}
      {backlinks.length === 0 && (
        <div className="text-xs text-text-muted p-2">No notes link here yet</div>
      )}
    </div>
  )
}
