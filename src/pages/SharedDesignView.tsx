/* pages/SharedDesignView.tsx */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { galleryService, loadDesignData } from '../services/galleryService'
import { useDesign } from '../store/designStore'
import { renderLayersToCanvas } from '../utils/renderLayersToCanvas'
import Mannequin from '../components/Three/Mannequin'
import SceneCanvas, { type SceneCanvasHandle } from '../components/Three/SceneCanva'
import type { GalleryItem } from '../lib/supabase'

export default function SharedDesignView() {
  const { shareToken } = useParams<{ shareToken: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [design, setDesign] = useState<GalleryItem | null>(null)
  const sceneRef = useRef<SceneCanvasHandle | null>(null)
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    if (!shareToken) {
      setError('Invalid share link')
      setLoading(false)
      return
    }

    // Prevent multiple loads
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true

    const loadSharedDesign = async () => {
      try {
        setLoading(true)
        setError(null)

        const { data, error: fetchError } = await galleryService.getSharedDesign(shareToken)

        if (fetchError || !data) {
          setError('Design not found or no longer shared')
          setLoading(false)
          return
        }

        setDesign(data)

        // Get store state directly (don't use hook in effect)
        const store = useDesign.getState()
        
        // Load design data into the store
        await loadDesignData(store, data.design_data)

        // Rebuild shirt canvas from layers
        // Create canvas and rebuild from layers
        const canvas = document.createElement('canvas')
        canvas.width = 2048
        canvas.height = 2048

        // Get base color and layers from loaded data
        const baseColor = data.design_data.baseColor || '#b91c1c'
        const layers = data.design_data.layers || []

        // Render all layers (images, text, shapes, paths) to canvas
        await renderLayersToCanvas(canvas, layers, baseColor)
        
        // Set the canvas in the store
        store.setShirtTexCanvas(canvas)
        store.bumpShirtTexStamp()
        
        setLoading(false)
      } catch (err) {
        console.error('Error loading shared design:', err)
        setError('Failed to load shared design')
        setLoading(false)
        hasLoadedRef.current = false // Allow retry on error
      }
    }

    loadSharedDesign()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareToken]) // Only depend on shareToken, not designStore

  const handleDownloadPicture = async () => {
    const dataUrl = sceneRef.current?.capturePngDataUrl() || null
    if (!dataUrl) {
      alert('Could not capture the 3D view. Try again after interacting with the scene.')
      return
    }

    const img = new Image()
    img.src = dataUrl
    await new Promise<void>((res) => { img.onload = () => res() })
    
    const w = img.naturalWidth
    const h = img.naturalHeight
    const footerH = Math.max(80, Math.floor(h * 0.12))
    const out = document.createElement('canvas')
    out.width = w
    out.height = h + footerH
    const ctx = out.getContext('2d')!
    ctx.fillStyle = '#0f1115'
    ctx.fillRect(0, 0, w, h + footerH)
    ctx.drawImage(img, 0, 0)
    
    // Add title text
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${Math.floor(footerH * 0.3)}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(
      design?.title || 'Shared Design',
      w / 2,
      h + footerH / 2
    )

    const link = document.createElement('a')
    link.download = `${(design?.title || 'shared-design').replace(/[^a-z0-9]/gi, '-')}.png`
    link.href = out.toDataURL('image/png')
    link.click()
  }

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="mb-4">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          </div>
          <p className="text-lg">Loading shared design...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold mb-4">Design Not Available</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{design?.title || 'Shared Design'}</h1>
          <p className="text-sm text-gray-400 mt-1">Shared by designer • Rotate and zoom to view</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadPicture}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
            title="Download as image"
          >
            <span>📥</span>
            <span>Download</span>
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </header>

      {/* 3D Viewer */}
      <div className="flex-1 relative">
        <SceneCanvas ref={sceneRef}>
          <Mannequin showClothes={true} />
        </SceneCanvas>
        <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur rounded-lg px-4 py-2 text-sm">
          <p className="text-gray-300">💡 Click and drag to rotate • Scroll to zoom</p>
        </div>
      </div>
    </div>
  )
}

