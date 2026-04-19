import { createClient } from '@supabase/supabase-js'
import type { Note, Folder } from '../types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseKey)

export type Database = {
  public: {
    Tables: {
      notes: { Row: Note; Insert: Omit<Note, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Note> }
      folders: { Row: Folder; Insert: Omit<Folder, 'id' | 'created_at'>; Update: Partial<Folder> }
    }
  }
}
