import { useState } from 'react'
import { useStore } from '../store/useStore'
import type { Folder, Note } from '../types'

export default function Sidebar() {
  const {
    notes, folders, activeNoteId, sidebarView,
    createNote, createFolder, setActiveNote, setSidebarView, setMainView, updateNote,
  } = useStore()
  const [search, setSearch] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [dragOverFolder, setDragOverFolder] = useState<string | 'root' | null>(null)

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleDrop = (folderId: string | null, e: React.DragEvent) => {
    e.preventDefault()
    const noteId = e.dataTransfer.getData('noteId')
    if (noteId) updateNote(noteId, { folder_id: folderId })
    setDragOverFolder(null)
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
      {/* App title */}
      <div className="px-4 py-3 flex items-center gap-2 border-b border-border-subtle flex-shrink-0">
        <span className="text-accent-purple text-lg">✦</span>
        <span className="font-semibold text-sm text-text-primary">Memory Grid</span>
      </div>

      {/* Nav icons */}
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
          <div className="p-2">
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

            {/* Folders */}
            {rootFolders.map((folder) => (
              <FolderItem
                key={folder.id}
                folder={folder}
                notes={notes}
                activeNoteId={activeNoteId}
                expanded={expandedFolders.has(folder.id)}
                isDragOver={dragOverFolder === folder.id}
                onToggle={toggleFolder}
                onNoteClick={setActiveNote}
                onDragOver={(e) => { e.preventDefault(); setDragOverFolder(folder.id) }}
                onDragLeave={() => setDragOverFolder(null)}
                onDrop={(e) => handleDrop(folder.id, e)}
              />
            ))}

            {/* Root drop zone + root notes */}
            <div
              className="rounded transition-colors"
              style={dragOverFolder === 'root' ? { background: 'rgba(124,106,247,0.08)', outline: '1px dashed rgba(124,106,247,0.4)' } : {}}
              onDragOver={(e) => { e.preventDefault(); setDragOverFolder('root') }}
              onDragLeave={() => setDragOverFolder(null)}
              onDrop={(e) => handleDrop(null, e)}
            >
              {rootNotes.map((note) => (
                <NoteItem
                  key={note.id}
                  note={note}
                  active={activeNoteId === note.id}
                  onClick={() => setActiveNote(note.id)}
                />
              ))}
              {dragOverFolder === 'root' && (
                <div className="text-xs text-text-muted text-center py-1 opacity-60">Drop to remove from folder</div>
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

      {/* Bottom view switcher */}
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
  onToggle, onNoteClick, onDragOver, onDragLeave, onDrop,
}: {
  folder: Folder
  notes: Note[]
  activeNoteId: string | null
  expanded: boolean
  isDragOver: boolean
  onToggle: (id: string) => void
  onNoteClick: (id: string) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
}) {
  const folderNotes = notes.filter((n) => n.folder_id === folder.id)
  return (
    <div
      className="rounded transition-colors mb-0.5"
      style={isDragOver ? { background: 'rgba(124,106,247,0.1)', outline: '1px dashed rgba(124,106,247,0.5)' } : {}}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <button
        className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-sm text-text-secondary hover:bg-bg-hover transition-colors"
        onClick={() => onToggle(folder.id)}
      >
        <span className="text-xs opacity-60">{expanded ? '▾' : '▸'}</span>
        <span className="opacity-60 text-xs">⬚</span>
        <span className="truncate">{folder.name}</span>
        <span className="ml-auto text-xs text-text-muted">{folderNotes.length}</span>
      </button>
      {expanded && (
        <div className="ml-4">
          {folderNotes.map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              active={activeNoteId === note.id}
              onClick={() => onNoteClick(note.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function NoteItem({ note, active, onClick }: { note: Note; active: boolean; onClick: () => void }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('noteId', note.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      className={`w-full flex items-center gap-2 px-2 py-1 rounded text-sm transition-colors cursor-grab active:cursor-grabbing ${
        active
          ? 'bg-bg-hover text-text-primary'
          : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
      }`}
      onClick={onClick}
    >
      <span className="opacity-40 text-xs flex-shrink-0">✦</span>
      <span className="truncate">{note.title || 'Untitled'}</span>
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
        />
      ))}
      {backlinks.length === 0 && (
        <div className="text-xs text-text-muted p-2">No notes link here yet</div>
      )}
    </div>
  )
}
