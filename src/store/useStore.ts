import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { extractWikiLinks } from '../lib/wikilinks'
import type { Note, Folder, ViewMode, SidebarView, MainView } from '../types'

interface AppState {
  // Data
  notes: Note[]
  folders: Folder[]
  activeNoteId: string | null

  // UI state
  viewMode: ViewMode
  sidebarView: SidebarView
  mainView: MainView
  sidebarOpen: boolean
  commandPaletteOpen: boolean

  // Derived
  links: Array<{ source: string; target: string }>

  // Actions
  loadData: (userId: string) => Promise<void>
  createNote: (title: string, folderId?: string) => Promise<Note>
  updateNote: (id: string, updates: Partial<Pick<Note, 'title' | 'content' | 'tags'>>) => Promise<void>
  deleteNote: (id: string) => Promise<void>
  createFolder: (name: string, parentId?: string) => Promise<void>
  setActiveNote: (id: string | null) => void
  setViewMode: (mode: ViewMode) => void
  setSidebarView: (view: SidebarView) => void
  setMainView: (view: MainView) => void
  setSidebarOpen: (open: boolean) => void
  setCommandPaletteOpen: (open: boolean) => void
  computeLinks: () => void
}

export const useStore = create<AppState>((set, get) => ({
  notes: [],
  folders: [],
  activeNoteId: null,
  viewMode: 'split',
  sidebarView: 'files',
  mainView: 'editor',
  sidebarOpen: true,
  commandPaletteOpen: false,
  links: [],

  loadData: async (userId) => {
    const [notesRes, foldersRes] = await Promise.all([
      supabase.from('notes').select('*').eq('user_id', userId).order('updated_at', { ascending: false }),
      supabase.from('folders').select('*').eq('user_id', userId),
    ])
    const notes = notesRes.data ?? []
    const folders = foldersRes.data ?? []
    set({ notes, folders })
    get().computeLinks()
  },

  createNote: async (title, folderId) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const { data, error } = await supabase
      .from('notes')
      .insert({ title, content: '', folder_id: folderId ?? null, tags: [], user_id: user.id })
      .select()
      .single()
    if (error) throw error
    set((s) => ({ notes: [data, ...s.notes], activeNoteId: data.id }))
    return data
  },

  updateNote: async (id, updates) => {
    const { error } = await supabase
      .from('notes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    }))
    get().computeLinks()
  },

  deleteNote: async (id) => {
    await supabase.from('notes').delete().eq('id', id)
    set((s) => ({
      notes: s.notes.filter((n) => n.id !== id),
      activeNoteId: s.activeNoteId === id ? null : s.activeNoteId,
    }))
    get().computeLinks()
  },

  createFolder: async (name, parentId) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase
      .from('folders')
      .insert({ name, parent_id: parentId ?? null, user_id: user.id })
      .select()
      .single()
    if (error) throw error
    set((s) => ({ folders: [...s.folders, data] }))
  },

  setActiveNote: (id) => set({ activeNoteId: id, mainView: 'editor' }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setSidebarView: (view) => set({ sidebarView: view }),
  setMainView: (view) => set({ mainView: view }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  computeLinks: () => {
    const { notes } = get()
    const titleToId = new Map(notes.map((n) => [n.title.toLowerCase(), n.id]))
    const links: Array<{ source: string; target: string }> = []
    for (const note of notes) {
      const targets = extractWikiLinks(note.content)
      for (const t of targets) {
        const targetId = titleToId.get(t.toLowerCase())
        if (targetId && targetId !== note.id) {
          links.push({ source: note.id, target: targetId })
        }
      }
    }
    set({ links })
  },
}))
