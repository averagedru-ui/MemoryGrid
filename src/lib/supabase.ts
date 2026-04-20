import { createClient } from '@supabase/supabase-js'
import type { Note, Folder } from '../types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseKey) {
  document.body.innerHTML = `
    <div style="display:flex;height:100vh;align-items:center;justify-content:center;background:#0d0d0f;font-family:sans-serif;color:#e8e8f0;text-align:center;padding:2rem">
      <div>
        <div style="font-size:2rem;margin-bottom:1rem">⚙️</div>
        <div style="font-weight:600;margin-bottom:.5rem">Missing environment variables</div>
        <div style="color:#9090a8;font-size:.875rem">VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in Vercel.<br/>Go to Vercel → Project Settings → Environment Variables.</div>
      </div>
    </div>`
  throw new Error('Missing Supabase env vars')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

export type Database = {
  public: {
    Tables: {
      notes: { Row: Note; Insert: Omit<Note, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Note> }
      folders: { Row: Folder; Insert: Omit<Folder, 'id' | 'created_at'>; Update: Partial<Folder> }
    }
  }
}
