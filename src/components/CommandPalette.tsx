import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'

export default function CommandPalette() {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { notes, setActiveNote, setCommandPaletteOpen, createNote, setMainView } = useStore()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const staticCommands = [
    { label: 'New note', icon: '+', action: () => { createNote('Untitled'); setCommandPaletteOpen(false) } },
    { label: 'Switch to Galaxy view', icon: '✦', action: () => { setMainView('galaxy'); setCommandPaletteOpen(false) } },
    { label: 'Switch to Graph view', icon: '◎', action: () => { setMainView('graph'); setCommandPaletteOpen(false) } },
    { label: "Today's daily note", icon: '◷', action: () => {
      const today = new Date().toISOString().slice(0, 10)
      const existing = notes.find((n) => n.title === today)
      if (existing) { setActiveNote(existing.id); setCommandPaletteOpen(false) }
      else { createNote(today).then(() => setCommandPaletteOpen(false)) }
    }},
  ]

  const noteResults = notes.filter((n) =>
    query ? n.title.toLowerCase().includes(query.toLowerCase()) : true
  ).slice(0, 8)

  const commandResults = staticCommands.filter((c) =>
    !query || c.label.toLowerCase().includes(query.toLowerCase())
  )

  const allResults = [
    ...commandResults.map((c) => ({ ...c, type: 'command' as const })),
    ...noteResults.map((n) => ({
      label: n.title || 'Untitled',
      icon: '✦',
      type: 'note' as const,
      action: () => { setActiveNote(n.id); setCommandPaletteOpen(false) },
    })),
  ]

  const [selected, setSelected] = useState(0)

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, allResults.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && allResults[selected]) allResults[selected].action()
    if (e.key === 'Escape') setCommandPaletteOpen(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && setCommandPaletteOpen(false)}
    >
      <div
        className="w-[560px] rounded-xl overflow-hidden shadow-2xl"
        style={{ background: '#141416', border: '1px solid #3a3a48' }}
      >
        <div className="flex items-center px-4 py-3 border-b border-border-subtle">
          <span className="text-text-muted mr-2">⌕</span>
          <input
            ref={inputRef}
            className="flex-1 bg-transparent outline-none text-text-primary placeholder-text-muted text-sm"
            placeholder="Search notes or commands…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0) }}
            onKeyDown={onKey}
          />
          <kbd className="text-xs text-text-muted px-1.5 py-0.5 rounded" style={{ background: '#2a2a35' }}>esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-1">
          {allResults.map((item, i) => (
            <button
              key={i}
              className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                i === selected ? 'bg-bg-hover text-text-primary' : 'text-text-secondary hover:bg-bg-hover'
              }`}
              onClick={item.action}
              onMouseEnter={() => setSelected(i)}
            >
              <span className={`w-5 text-center ${item.type === 'note' ? 'text-accent-purple opacity-60 text-xs' : 'text-text-muted'}`}>
                {item.icon}
              </span>
              <span>{item.label}</span>
              {item.type === 'note' && (
                <span className="ml-auto text-xs text-text-muted">note</span>
              )}
            </button>
          ))}
          {allResults.length === 0 && (
            <div className="px-4 py-3 text-sm text-text-muted">No results for "{query}"</div>
          )}
        </div>
      </div>
    </div>
  )
}
