/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js'

// Supabase configuration
// Replace these with your actual Supabase project credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://htfevmrkhlndvkmkvmkz.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0ZmV2bXJraGxuZHZrbWt2bWt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3MDcyODMsImV4cCI6MjA3NzI4MzI4M30.Pk7dtU0LViMfONt-CuhW4mL3NRaEQ3fUrfNjhkbcxx8'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

// Types for our database
export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface GalleryItem {
  id: string
  user_id: string
  title: string | null
  design_data: any // Will store the complete design state
  thumbnail_url: string | null
  share_token: string | null
  is_shared: boolean
  created_at: string
  updated_at: string
}

