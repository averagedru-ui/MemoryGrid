import { useEffect, useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { supabase } from './lib/supabase'
import { useStore } from './store/useStore'
import Sidebar from './components/Sidebar'
import Editor from './components/Editor'
import GalaxyView from './components/GalaxyView'
import GraphView from './components/GraphView'
import CommandPalette from './components/CommandPalette'
import ImportModal from './components/ImportModal'
import type { Session } from '@supabase/supabase-js'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [showImport, setShowImport] = useState(false)

  const {
    activeNoteId, mainView, sidebarOpen, commandPaletteOpen,
    loadData, setCommandPaletteOpen,
  } = useStore()

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthLoading(false)
      if (session) loadData(session.user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, session) => {
      setSession(session)
      if (session) loadData(session.user.id)
    })
    return () => subscription.unsubscribe()
  }, [loadData])

  // Global keybindings
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') { e.preventDefault(); setCommandPaletteOpen(true) }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setCommandPaletteOpen(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setCommandPaletteOpen])

  if (authLoading) return <Splash />
  if (!session) return <AuthScreen />

  return (
    <div className="flex h-full w-full overflow-hidden" style={{ background: '#0d0d0f' }}>
      <PanelGroup direction="horizontal">
        {/* Sidebar */}
        {sidebarOpen && (
          <>
            <Panel defaultSize={18} minSize={12} maxSize={30}>
              <div className="h-full flex flex-col">
                {/* Import button */}
                <div className="px-2 pt-2 flex-shrink-0">
                  <button
                    className="w-full text-xs py-1.5 rounded transition-colors text-text-muted hover:text-text-primary hover:bg-bg-hover"
                    onClick={() => setShowImport(true)}
                  >
                    ↓ Import Obsidian Vault
                  </button>
                </div>
                <Sidebar />
              </div>
            </Panel>
            <PanelResizeHandle className="w-px hover:w-0.5 transition-all" style={{ background: '#2a2a35' }} />
          </>
        )}

        {/* Main content */}
        <Panel>
          <div className="h-full flex flex-col">
            {/* Toolbar */}
            <div
              className="flex items-center gap-2 px-4 h-10 flex-shrink-0 border-b border-border-subtle"
              style={{ background: '#141416' }}
            >
              <ViewToggle />
              <div className="ml-auto flex items-center gap-2">
                <button
                  className="text-xs px-2 py-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                  onClick={() => setCommandPaletteOpen(true)}
                >
                  ⌕ Search
                  <kbd className="ml-2 opacity-50">⌘P</kbd>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden min-h-0">
              <PanelGroup direction="horizontal">
                <Panel>
                  {mainView === 'editor' && (
                    activeNoteId
                      ? <div className="h-full overflow-auto"><Editor noteId={activeNoteId} /></div>
                      : <EmptyState />
                  )}
                  {mainView === 'galaxy' && <GalaxyView />}
                  {mainView === 'graph' && <GraphView />}
                </Panel>

              </PanelGroup>
            </div>
          </div>
        </Panel>
      </PanelGroup>

      {commandPaletteOpen && <CommandPalette />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
    </div>
  )
}

function ViewToggle() {
  const { mainView, setMainView } = useStore()
  const views = [
    { id: 'editor', label: '✎' },
    { id: 'graph', label: '◎' },
    { id: 'galaxy', label: '✦' },
  ] as const

  return (
    <div className="flex rounded overflow-hidden" style={{ border: '1px solid #2a2a35' }}>
      {views.map(({ id, label }) => (
        <button
          key={id}
          className={`px-2.5 py-1 text-sm transition-colors ${mainView === id ? 'text-white' : 'text-text-muted hover:text-text-primary'}`}
          style={{ background: mainView === id ? 'rgba(124,106,247,0.25)' : 'transparent' }}
          onClick={() => setMainView(id)}
          title={id}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function EmptyState() {
  const { createNote, setCommandPaletteOpen } = useStore()
  return (
    <div className="flex h-full items-center justify-center text-center">
      <div>
        <div className="text-5xl mb-4 opacity-20 text-accent-purple">✦</div>
        <div className="text-text-secondary mb-1 font-medium">Memory Grid</div>
        <div className="text-text-muted text-sm mb-6">Your personal knowledge base</div>
        <div className="flex flex-col gap-2 items-center">
          <button
            className="px-4 py-2 rounded-lg text-sm text-white"
            style={{ background: '#7c6af7' }}
            onClick={() => createNote('Untitled')}
          >
            Create first note
          </button>
          <button
            className="text-sm text-text-muted hover:text-text-primary transition-colors"
            onClick={() => setCommandPaletteOpen(true)}
          >
            or press ⌘P to search
          </button>
        </div>
      </div>
    </div>
  )
}

function Splash() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="text-4xl text-accent-purple animate-pulse mb-3">✦</div>
        <div className="text-text-muted text-sm">Loading…</div>
      </div>
    </div>
  )
}

function AuthScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifyPrompt, setVerifyPrompt] = useState(false)

  const submit = async () => {
    setLoading(true)
    setError('')
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setVerifyPrompt(true)
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }
    setLoading(false)
  }

  if (verifyPrompt) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="w-80 p-8 rounded-2xl text-center" style={{ background: '#141416', border: '1px solid #2a2a35' }}>
          <div className="text-4xl mb-3">✉️</div>
          <div className="font-semibold text-text-primary mb-2">Check your email</div>
          <div className="text-sm text-text-muted mb-4">
            We sent a verification link to <span className="text-text-secondary">{email}</span>.<br />
            Click it to activate your account, then sign in.
          </div>
          <button
            className="text-sm text-accent-purple hover:underline"
            onClick={() => { setVerifyPrompt(false); setMode('signin') }}
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="w-80 p-8 rounded-2xl" style={{ background: '#141416', border: '1px solid #2a2a35' }}>
        <div className="text-center mb-6">
          <div className="text-4xl text-accent-purple mb-2">✦</div>
          <div className="font-semibold text-text-primary">Memory Grid</div>
          <div className="text-xs text-text-muted mt-1">Your personal knowledge base</div>
        </div>

        <div className="space-y-3">
          <input
            className="w-full px-3 py-2 rounded-lg text-sm bg-bg-tertiary border border-border-subtle text-text-primary placeholder-text-muted outline-none focus:border-accent-purple transition-colors"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full px-3 py-2 rounded-lg text-sm bg-bg-tertiary border border-border-subtle text-text-primary placeholder-text-muted outline-none focus:border-accent-purple transition-colors"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          {error && <div className="text-red-400 text-xs">{error}</div>}
          <button
            className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ background: '#7c6af7' }}
            disabled={loading}
            onClick={submit}
          >
            {loading ? 'Loading…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </div>

        <button
          className="w-full mt-3 text-xs text-text-muted hover:text-text-secondary transition-colors"
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError('') }}
        >
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}
