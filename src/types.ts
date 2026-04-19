export interface Note {
  id: string
  title: string
  content: string
  folder_id: string | null
  tags: string[]
  created_at: string
  updated_at: string
  user_id: string
  is_daily?: boolean
  frontmatter?: Record<string, unknown>
}

export interface Folder {
  id: string
  name: string
  parent_id: string | null
  user_id: string
  created_at: string
}

export interface NoteLink {
  source_id: string
  target_id: string
}

export type ViewMode = 'editor' | 'preview' | 'split'
export type SidebarView = 'files' | 'search' | 'tags' | 'backlinks'
export type MainView = 'editor' | 'graph' | 'galaxy'
