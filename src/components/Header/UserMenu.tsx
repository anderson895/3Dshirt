import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { User } from '@supabase/supabase-js'
import './UserMenu.css'

export default function UserMenu({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const [user, setUser] = useState<User | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const navigate = useNavigate()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Check for current user
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenu])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setShowMenu(false)
    navigate('/')
  }

  const handleNavigation = (path: string) => {
    setShowMenu(false)
    navigate(path)
  }

  if (user) {
    // User is logged in - show menu
    return (
      <div className={`user-menu-container ${variant}`} ref={menuRef}>
        <button 
          className="user-menu-button"
          onClick={() => setShowMenu(!showMenu)}
        >
          <svg className="user-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="user-email">{user.email?.split('@')[0] || 'User'}</span>
          <svg className="dropdown-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {showMenu && (
          <div className="user-menu-dropdown">
            <div className="user-menu-header">
              <span className="user-email-full">{user.email}</span>
            </div>
            <button 
              className="user-menu-item"
              onClick={() => handleNavigation('/gallery')}
            >
              <svg className="menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              My Gallery
            </button>
            <button 
              className="user-menu-item"
              onClick={() => handleNavigation('/customize')}
            >
              <svg className="menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a2 2 0 012-2h12a2 2 0 012 2v16l-4-3-4 3-4-3V5z" />
              </svg>
              New Design
            </button>
            <div className="user-menu-divider"></div>
            <button 
              className="user-menu-item logout"
              onClick={handleSignOut}
            >
              <svg className="menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        )}
      </div>
    )
  }

  // User is not logged in - show sign in button
  return (
    <button 
      className="signin-button"
      onClick={() => handleNavigation('/signin')}
    >
      Sign In
    </button>
  )
}

