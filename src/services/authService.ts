/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

// Determine the app origin from env in production, fallback to current origin in dev
const APP_ORIGIN = (import.meta as any)?.env?.VITE_APP_ORIGIN ?? window.location.origin

export interface AuthState {
  user: User | null
  loading: boolean
}

export const authService = {
  // Sign up with email and password
  async signUp(email: string, password: string, fullName?: string) {
    const normalizedEmail = email.trim().toLowerCase()
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        // Where Supabase will redirect after email confirmation
        emailRedirectTo: `${APP_ORIGIN}`,
        data: {
          full_name: fullName || normalizedEmail.split('@')[0],
        },
      },
    })
    return { data, error }
  },

  // Sign in with email and password
  async signIn(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })
    return { data, error }
  },

  // Sign out
  async signOut() {
    // Ensure local session is fully cleared
    const { error } = await supabase.auth.signOut({ scope: 'local' as any })
    return { error }
  },

  // Get current session
  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession()
    return { session, error }
  },

  // Get current user
  getCurrentUser() {
    return supabase.auth.getUser()
  },

  // Listen to auth state changes
  onAuthStateChange(callback: (user: User | null) => void) {
    return supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ?? null)
    })
  },

  // Password reset
  async resetPassword(email: string) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${APP_ORIGIN}/reset-password`,
    })
    return { data, error }
  },

  // Update password
  async updatePassword(newPassword: string) {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    })
    return { data, error }
  },
}

