import { useState, useRef } from 'react'
import { useStore } from '../store/useStore'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function ClaudePanel() {
  const { notes, activeNoteId, setClaudeOpen } = useStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const activeNote = notes.find((n) => n.id === activeNoteId)

  const send = async (userMessage: string) => {
    if (!userMessage.trim() || loading) return
    setInput('')
    setLoading(true)

    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }]
    setMessages(newMessages)

    // Build vault context (last 5 notes for context window)
    const vaultContext = notes
      .slice(0, 5)
      .map((n) => `# ${n.title}\n${n.content.slice(0, 500)}`)
      .join('\n\n---\n\n')

    const systemPrompt = `You are an AI assistant integrated into Memory Grid, a personal knowledge base app.
The user's vault contains ${notes.length} notes.

${activeNote ? `Current note: "${activeNote.title}"\n\n${activeNote.content.slice(0, 2000)}` : 'No note is currently open.'}

Recent vault context:
${vaultContext}

Help the user with their notes, answer questions about their knowledge base, and assist with writing.`

    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: systemPrompt,
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json() as { content: string }
      setMessages((prev) => [...prev, { role: 'assistant', content: data.content }])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Connection error. Check your API settings.' },
      ])
    } finally {
      setLoading(false)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }

  const quickActions = [
    { label: 'Summarize', prompt: 'Summarize the current note in 3 bullet points.' },
    { label: 'Expand', prompt: 'Expand the current note with more detail and examples.' },
    { label: 'Auto-tag', prompt: 'Suggest 5 relevant tags for the current note. Return just the tags as a comma-separated list.' },
    { label: 'Make quiz', prompt: 'Create a 5-question quiz based on the current note to test my understanding.' },
  ]

  return (
    <div className="flex flex-col h-full border-l border-border-subtle" style={{ background: '#141416' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-accent-purple">◈</span>
          <span className="text-sm font-medium text-text-primary">Claude</span>
        </div>
        <button
          className="text-text-muted hover:text-text-primary transition-colors text-lg leading-none"
          onClick={() => setClaudeOpen(false)}
        >
          ×
        </button>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-1.5 p-3 border-b border-border-subtle flex-shrink-0">
        {quickActions.map((a) => (
          <button
            key={a.label}
            className="px-2.5 py-1 rounded text-xs transition-colors text-text-muted hover:text-accent-purple"
            style={{ background: 'rgba(124,106,247,0.08)', border: '1px solid rgba(124,106,247,0.2)' }}
            onClick={() => send(a.prompt)}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="text-xs text-text-muted text-center mt-4">
            Ask anything about your notes,<br />or use a quick action above.
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] px-3 py-2 rounded-lg text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'text-text-primary'
                  : 'text-text-secondary'
              }`}
              style={
                msg.role === 'user'
                  ? { background: 'rgba(124,106,247,0.15)', border: '1px solid rgba(124,106,247,0.25)' }
                  : { background: '#1a1a1f', border: '1px solid #2a2a35' }
              }
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-lg text-sm text-text-muted" style={{ background: '#1a1a1f', border: '1px solid #2a2a35' }}>
              <span className="animate-pulse">Thinking…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border-subtle flex-shrink-0">
        <div className="flex gap-2">
          <input
            className="flex-1 px-3 py-2 rounded text-sm bg-bg-tertiary border border-border-subtle text-text-primary placeholder-text-muted outline-none focus:border-accent-purple transition-colors"
            placeholder="Ask about your notes…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send(input)}
          />
          <button
            className="px-3 py-2 rounded text-sm text-white transition-colors disabled:opacity-40"
            style={{ background: loading ? '#3a3a48' : '#7c6af7' }}
            disabled={loading || !input.trim()}
            onClick={() => send(input)}
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  )
}
