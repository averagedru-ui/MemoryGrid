import { useEffect, useRef, useCallback } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, placeholder } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { useStore } from '../store/useStore'

interface EditorProps {
  noteId: string
}

export default function Editor({ noteId }: EditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>()

  const { notes, updateNote } = useStore()
  const note = notes.find((n) => n.id === noteId)

  const save = useCallback(
    (content: string) => {
      clearTimeout(saveTimeout.current)
      saveTimeout.current = setTimeout(() => {
        updateNote(noteId, { content })
      }, 600)
    },
    [noteId, updateNote]
  )

  useEffect(() => {
    if (!editorRef.current || !note) return

    const state = EditorState.create({
      doc: note.content,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown({ base: markdownLanguage }),
        placeholder('Start writing…'),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) save(update.state.doc.toString())
        }),
        EditorView.theme({
          '&': { background: 'transparent', height: '100%' },
          '.cm-scroller': { fontFamily: 'Inter, system-ui, sans-serif' },
        }),
      ],
    })

    const view = new EditorView({ state, parent: editorRef.current })
    viewRef.current = view

    return () => {
      clearTimeout(saveTimeout.current)
      view.destroy()
      viewRef.current = null
    }
    // Intentionally not re-running on note.content change — we own the content once mounted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId])

  if (!note) return null

  return (
    <div className="flex flex-col h-full">
      {/* Title bar */}
      <div className="px-8 pt-8 pb-2 flex-shrink-0">
        <input
          className="w-full text-2xl font-semibold bg-transparent border-none outline-none text-text-primary placeholder-text-muted"
          value={note.title}
          placeholder="Untitled"
          onChange={(e) => updateNote(noteId, { title: e.target.value })}
        />
        <div className="mt-1 text-xs text-text-muted">
          {new Date(note.updated_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </div>
      </div>

      {/* Tags */}
      <div className="px-8 py-2 flex flex-wrap gap-1 flex-shrink-0">
        {note.tags.map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 rounded text-xs text-accent-purple"
            style={{ background: 'rgba(124,106,247,0.12)' }}
          >
            #{tag}
          </span>
        ))}
      </div>

      {/* CodeMirror editor */}
      <div ref={editorRef} className="flex-1 overflow-auto min-h-0" />
    </div>
  )
}
