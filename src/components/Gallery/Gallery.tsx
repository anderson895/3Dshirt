import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { galleryService, loadDesignData } from '../../services/galleryService'
import { authService } from '../../services/authService'
import { supabase } from '../../lib/supabase'
import { useDesign } from '../../store/designStore'
import type { GalleryItem } from '../../lib/supabase'
import type { User } from '@supabase/supabase-js'
import ImageViewer from './ImageViewer'
import './Gallery.css'

export default function Gallery() {
  const navigate = useNavigate()
  const designStore = useDesign()
  const [designs, setDesigns] = useState<GalleryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [viewingImage, setViewingImage] = useState<string | null>(null)
  const [viewingTitle, setViewingTitle] = useState<string>('')
  const [sharingDesignId, setSharingDesignId] = useState<string | null>(null)

  useEffect(() => {
    // Check for current user
    authService.getSession().then(({ session }) => {
      setUser(session?.user ?? null)
    })

    // Load designs
    loadDesigns()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadDesigns()
      } else {
        setDesigns([])
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const loadDesigns = async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await galleryService.getMyDesigns()
    if (error) {
      setError(error.message)
    } else {
      setDesigns(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    if (user) {
      loadDesigns()
    }
  }, [user])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this design?')) return

    const { error } = await galleryService.deleteDesign(id)
    if (error) {
      setError(error.message)
    } else {
      loadDesigns()
    }
  }

  const handleViewImage = (imageUrl: string, title: string) => {
    setViewingImage(imageUrl)
    setViewingTitle(title)
  }

  const handleSignOut = async () => {
    await authService.signOut()
    setUser(null)
    setDesigns([])
  }

  const handleLoadDesign = async (design: GalleryItem) => {
    try {
      // Load design data into the store
      await loadDesignData(designStore, design.design_data)
      
      // Navigate to design page first to rebuild canvas, then to customize
      // The design page will automatically rebuild the canvas from layers
      navigate('/design')
      
      // After a short delay, navigate to customize so canvas is ready
      setTimeout(() => {
        navigate('/customize')
      }, 500)
    } catch (err) {
      console.error('Error loading design:', err)
      setError('Failed to load design. Please try again.')
    }
  }

  const handleShare = async (design: GalleryItem) => {
    try {
      setSharingDesignId(design.id)
      const { data, error } = await galleryService.shareDesign(design.id)
      
      if (error) {
        alert('Failed to share design: ' + error.message)
      } else if (data) {
        const url = data.shareUrl || `${window.location.origin}/shared/${data.share_token}`
        
        // Copy to clipboard
        try {
          await navigator.clipboard.writeText(url)
          alert('Share link copied to clipboard! Share this link with your client.')
        } catch {
          // Fallback: show the URL in a prompt
          prompt('Share this link with your client:', url)
        }
        
        // Reload designs to update share status
        loadDesigns()
      }
    } catch (err) {
      console.error('Error sharing design:', err)
      alert('Failed to share design')
    } finally {
      setSharingDesignId(null)
    }
  }

  const handleUnshare = async (design: GalleryItem) => {
    if (!confirm('Are you sure you want to unshare this design? Clients will no longer be able to view it.')) {
      return
    }

    try {
      const { error } = await galleryService.unshareDesign(design.id)
      
      if (error) {
        alert('Failed to unshare design: ' + error.message)
      } else {
        loadDesigns()
      }
    } catch (err) {
      console.error('Error unsharing design:', err)
      alert('Failed to unshare design')
    }
  }

  if (!user) {
    return (
      <div className="gallery-container">
        <div className="gallery-empty">
          <p>Please sign in to view your gallery</p>
        </div>
      </div>
    )
  }

  return (
    <div className="gallery-container">
      <div className="gallery-header">
        <div>
          <h2>My Design Gallery</h2>
          <p className="gallery-subtitle">Manage and load your saved t-shirt designs</p>
        </div>
        <div className="gallery-actions">
          <button onClick={() => window.location.href = '/customize'} className="btn-new-design">
            New Design
          </button>
          <button onClick={handleSignOut} className="btn-signout">
            Sign Out
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading && designs.length === 0 ? (
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading your designs...</p>
        </div>
      ) : designs.length === 0 ? (
        <div className="gallery-empty">
          <div className="empty-icon">🎨</div>
          <h3>No designs yet</h3>
          <p>Create and save your first t-shirt design!</p>
          <button 
            onClick={() => window.location.href = '/customize'} 
            className="btn-create-first"
          >
            Create Your First Design
          </button>
        </div>
      ) : (
        <>
          <div className="gallery-stats">
            <span>{designs.length} {designs.length === 1 ? 'design' : 'designs'} saved</span>
          </div>
          <div className="gallery-grid">
            {designs.map((design) => (
              <div key={design.id} className="gallery-item">
                <div 
                  className="gallery-item-preview"
                  onClick={() => design.thumbnail_url && handleViewImage(design.thumbnail_url, design.title || 'Untitled Design')}
                  style={{ cursor: design.thumbnail_url ? 'pointer' : 'default' }}
                >
                  {design.thumbnail_url ? (
                    <img src={design.thumbnail_url} alt={design.title || 'Design'} />
                  ) : (
                    <div className="gallery-item-placeholder">
                      <span className="placeholder-icon">👕</span>
                      <span className="placeholder-text">3D T-Shirt Design</span>
                    </div>
                  )}
                </div>
                <div className="gallery-item-info">
                  <h3>{design.title || 'Untitled Design'}</h3>
                  <p className="gallery-item-date">
                    <span className="date-icon">📅</span>
                    {new Date(design.created_at).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </p>
                  <div className="gallery-item-actions">
                    <button 
                      onClick={() => handleLoadDesign(design)} 
                      className="btn-load"
                      title="Load and edit this design"
                    >
                      <span>✏️</span>
                      Edit
                    </button>
                    {design.is_shared && design.share_token ? (
                      <>
                        <button 
                          onClick={() => {
                            const url = `${window.location.origin}/shared/${design.share_token}`
                            navigator.clipboard.writeText(url).then(() => {
                              alert('Share link copied to clipboard!')
                            }).catch(() => {
                              prompt('Share this link:', url)
                            })
                          }}
                          className="btn-share-active"
                          title="Copy share link"
                        >
                          <span>🔗</span>
                          Copy Link
                        </button>
                        <button 
                          onClick={() => handleUnshare(design)} 
                          className="btn-unshare"
                          title="Stop sharing this design"
                        >
                          <span>🔒</span>
                          Unshare
                        </button>
                      </>
                    ) : (
                      <button 
                        onClick={() => handleShare(design)} 
                        className="btn-share"
                        title="Share this design with clients"
                        disabled={sharingDesignId === design.id}
                      >
                        <span>📤</span>
                        {sharingDesignId === design.id ? 'Sharing...' : 'Share'}
                      </button>
                    )}
                    <button 
                      onClick={() => handleDelete(design.id)} 
                      className="btn-delete"
                      title="Delete this design"
                    >
                      <span>🗑️</span>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      
      {/* Image Viewer Modal */}
      <ImageViewer 
        imageUrl={viewingImage} 
        onClose={() => setViewingImage(null)}
        title={viewingTitle}
      />
    </div>
  )
}

