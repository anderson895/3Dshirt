/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import Mannequin from '../components/Three/Mannequin'
import SceneCanvas, { type SceneCanvasHandle } from '../components/Three/SceneCanva'
import { useDesign } from '../store/designStore'
import { computeFit } from '../utils/fit'
import { useCallback, useRef, useState, useEffect } from 'react'
import { galleryService, exportDesignData } from '../services/galleryService'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { DesignState } from '../store/designStore'
import { useNavigate } from 'react-router-dom'

export default function Review() {
  const navigate = useNavigate()
  const { 
    gender, preset, bodyType, bodyTypeIntensity, heightScale, 
    measurements, garment, shirtTexCanvas, baseColor, skinColor, layers 
  } = useDesign()
  const fit = computeFit(measurements, garment)

  const hasAtlas = !!shirtTexCanvas
  const [user, setUser] = useState<User | null>(null)
  const [saving, setSaving] = useState(false)

  const sceneRef = useRef<SceneCanvasHandle | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSaveDesign = async () => {
    if (!user) {
      // Navigate to signin page if user is not authenticated
      navigate('/signin')
      return
    }

    setSaving(true)
    try {
      // Capture thumbnail from the 3D scene
      let thumbnailDataUrl: string | undefined = undefined
      try {
        // Get the canvas element from the scene ref
        const canvasDataUrl = sceneRef.current?.capturePngDataUrl()
        if (canvasDataUrl) {
          thumbnailDataUrl = canvasDataUrl
        }
      } catch (err) {
        console.warn('Could not capture thumbnail:', err)
      }

      const designData = exportDesignData({ 
        gender, preset, bodyType, bodyTypeIntensity, heightScale, 
        measurements, garment, baseColor, skinColor, layers 
      } as Partial<DesignState>)
      
      const title = prompt('Enter a title for this design:') || 'Untitled Design'
      const { error } = await galleryService.saveDesign(designData, title, thumbnailDataUrl)
      
      if (error) {
        alert('Failed to save design: ' + error.message)
      } else {
        alert('Design saved successfully to your gallery!')
        // Navigate to gallery after successful save
        navigate('/gallery')
      }
    } catch {
      alert('Failed to save design')
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadPicture = useCallback(async () => {
    const dataUrl = sceneRef.current?.capturePngDataUrl() || null
    if (!dataUrl) {
      alert('Could not capture the 3D view. Try again after interacting with the scene.')
      return
    }
    // Compose footer with simple body size text under the snapshot
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
    ctx.fillRect(0, 0, out.width, out.height)
    ctx.drawImage(img, 0, 0)
    ctx.fillStyle = '#ffffff'
    ctx.font = '16px sans-serif'
    const sz = garment.preset ? `Size ${garment.preset}` : `${(garment.custom?.widthIn??20).toFixed(1)}×${(garment.custom?.lengthIn??28).toFixed(1)} in`
    const text = `H ${measurements.heightCm.toFixed(0)}cm • C ${measurements.chestCm.toFixed(0)}cm • W ${measurements.waistCm.toFixed(0)}cm • S ${measurements.shouldersCm.toFixed(0)}cm • Garment ${sz} • Fit ${garment.style}`
    ctx.fillText(text, 16, h + Math.floor(footerH * 0.6))

    const blob = await new Promise<Blob | null>((resolve) => out.toBlob((b) => resolve(b), 'image/png'))
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'shirt-preview.png'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 500)
  }, [measurements, garment])

  const sliceAtlasPart = useCallback(async (part: 'front'|'back'|'sleeveL'|'sleeveR'): Promise<Blob | null> => {
    if (!shirtTexCanvas) return null
    const atlas = shirtTexCanvas
    const halfW = Math.floor(atlas.width / 2)
    const halfH = Math.floor(atlas.height / 2)
    const rects: Record<typeof part, { sx:number; sy:number; sw:number; sh:number }> = {
      front:   { sx: 0,       sy: 0,       sw: halfW, sh: halfH },
      back:    { sx: halfW,   sy: 0,       sw: halfW, sh: halfH },
      sleeveL: { sx: 0,       sy: halfH,   sw: halfW, sh: halfH },
      sleeveR: { sx: halfW,   sy: halfH,   sw: halfW, sh: halfH },
    } as const
    const { sx, sy, sw, sh } = rects[part]
    const out = document.createElement('canvas')
    out.width = sw
    out.height = sh
    const ctx = out.getContext('2d')!
    ctx.drawImage(atlas, sx, sy, sw, sh, 0, 0, sw, sh)
    return await new Promise<Blob | null>((resolve) => out.toBlob((b) => resolve(b), 'image/png'))
  }, [shirtTexCanvas])

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 500)
  }

  const handleDownloadPNGs = useCallback(async () => {
    if (!shirtTexCanvas) return
    
    // Load UV guide image
    const uvGuideImg = new Image()
    uvGuideImg.crossOrigin = 'anonymous'
    await new Promise<void>((resolve, reject) => {
      uvGuideImg.onload = () => resolve()
      uvGuideImg.onerror = () => reject(new Error('Failed to load UV guide image'))
      uvGuideImg.src = '/uvtshirt.png'
    })

    // Detect actual image size and calculate quadrant positions accordingly
    const imgWidth = uvGuideImg.naturalWidth
    const imgHeight = uvGuideImg.naturalHeight
    const quadrantWidth = imgWidth / 2
    const quadrantHeight = imgHeight / 2
    
    // Quadrant positions in the UV atlas (adjusted for actual image size)
    const UV_QUADRANT_POSITIONS: Record<'front'|'back'|'sleeveL'|'sleeveR', { x: number; y: number }> = {
      front: { x: 0, y: 0 },
      back: { x: quadrantWidth, y: 0 },
      sleeveL: { x: 0, y: quadrantHeight },
      sleeveR: { x: quadrantWidth, y: quadrantHeight },
    }

    // Helper function to create composite image with UV guide + design
    const createCompositePart = async (part: 'front'|'back'|'sleeveL'|'sleeveR'): Promise<Blob | null> => {
      const quadrantPos = UV_QUADRANT_POSITIONS[part]
      const partSize = 1024 // Output size is always 1024x1024
      
      // Create composite canvas
      const compositeCanvas = document.createElement('canvas')
      compositeCanvas.width = partSize
      compositeCanvas.height = partSize
      const ctx = compositeCanvas.getContext('2d')!
      
      // Clear canvas to ensure no artifacts
      ctx.clearRect(0, 0, partSize, partSize)
      
      // Draw only the relevant quadrant from UV guide as background (full opacity)
      // Crop the specific quadrant from the UV guide image and scale it to fit the output canvas
      const sourceX = quadrantPos.x
      const sourceY = quadrantPos.y
      const sourceWidth = quadrantWidth
      const sourceHeight = quadrantHeight
      
      ctx.drawImage(
        uvGuideImg,
        sourceX, sourceY, sourceWidth, sourceHeight, // Source: crop ONLY this quadrant from UV guide
        0, 0, partSize, partSize // Destination: scale and draw to full output canvas
      )
      
      // Draw user's design on top with reduced opacity so UV guidelines remain visible
      const designBlob = await sliceAtlasPart(part)
      if (designBlob) {
        const designImg = new Image()
        await new Promise<void>((resolve) => {
          designImg.onload = () => {
            // Save context state
            ctx.save()
            // Set opacity for design layer (0.6 = 60% opacity, so UV guide shows through)
            ctx.globalAlpha = 0.6
            ctx.drawImage(designImg, 0, 0, partSize, partSize)
            // Restore context state
            ctx.restore()
            resolve()
          }
          designImg.src = URL.createObjectURL(designBlob)
        })
        URL.revokeObjectURL(designImg.src)
      }
      
      return await new Promise<Blob | null>((resolve) => 
        compositeCanvas.toBlob((b) => resolve(b), 'image/png')
      )
    }

    const parts: Array<'front'|'back'|'sleeveL'|'sleeveR'> = ['front','back','sleeveL','sleeveR']
    for (const p of parts) {
      const blob = await createCompositePart(p)
      if (blob) {
        const sizeLabel = garment.preset ? garment.preset : `${(garment.custom?.widthIn??20).toFixed(0)}x${(garment.custom?.lengthIn??28).toFixed(0)}in`
        downloadBlob(blob, `shirt-${p}-${sizeLabel}.png`)
      }
    }
  }, [shirtTexCanvas, sliceAtlasPart, garment])

  const handleDownloadPDF = useCallback(async () => {
    if (!shirtTexCanvas) return
    try {
      // Lazy-load jsPDF. If not installed, a helpful alert is shown.
      // @vite-ignore prevents dev server from resolving it at transform time
      const { jsPDF } = await import(/* @vite-ignore */ 'jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })

      const parts: Array<{ key:'front'|'back'|'sleeveL'|'sleeveR'; label: string }> = [
        { key: 'front', label: 'Front' },
        { key: 'back', label: 'Back' },
        { key: 'sleeveL', label: 'Left Sleeve' },
        { key: 'sleeveR', label: 'Right Sleeve' },
      ]

      // Load UV guide image
      const uvGuideImg = new Image()
      uvGuideImg.crossOrigin = 'anonymous'
      await new Promise<void>((resolve, reject) => {
        uvGuideImg.onload = () => resolve()
        uvGuideImg.onerror = () => reject(new Error('Failed to load UV guide image'))
        uvGuideImg.src = '/uvtshirt.png'
      })

      // Detect actual image size and calculate quadrant positions accordingly
      const imgWidth = uvGuideImg.naturalWidth
      const imgHeight = uvGuideImg.naturalHeight
      const quadrantWidth = imgWidth / 2
      const quadrantHeight = imgHeight / 2
      
      // Quadrant positions in the UV atlas (adjusted for actual image size)
      const UV_QUADRANT_POSITIONS: Record<'front'|'back'|'sleeveL'|'sleeveR', { x: number; y: number }> = {
        front: { x: 0, y: 0 },
        back: { x: quadrantWidth, y: 0 },
        sleeveL: { x: 0, y: quadrantHeight },
        sleeveR: { x: quadrantWidth, y: quadrantHeight },
      }

      // Helper function to create composite image with UV guide + design
      const createCompositePart = async (part: 'front'|'back'|'sleeveL'|'sleeveR'): Promise<string> => {
        const quadrantPos = UV_QUADRANT_POSITIONS[part]
        const partSize = 1024 // Output size is always 1024x1024
        
        // Create composite canvas
        const compositeCanvas = document.createElement('canvas')
        compositeCanvas.width = partSize
        compositeCanvas.height = partSize
        const ctx = compositeCanvas.getContext('2d')!
        
        // Clear canvas to ensure no artifacts
        ctx.clearRect(0, 0, partSize, partSize)
        
        // Draw only the relevant quadrant from UV guide as background
        // Crop the specific quadrant from the UV guide image and scale it to fit the output canvas
        const sourceX = quadrantPos.x
        const sourceY = quadrantPos.y
        const sourceWidth = quadrantWidth
        const sourceHeight = quadrantHeight
        
        ctx.drawImage(
          uvGuideImg,
          sourceX, sourceY, sourceWidth, sourceHeight, // Source: crop ONLY this quadrant from UV guide
          0, 0, partSize, partSize // Destination: scale and draw to full output canvas
        )
        
        // Draw user's design on top with reduced opacity so UV guidelines remain visible
        const designBlob = await sliceAtlasPart(part)
        if (designBlob) {
          const designImg = new Image()
          await new Promise<void>((resolve) => {
            designImg.onload = () => {
              // Save context state
              ctx.save()
              // Set opacity for design layer (0.6 = 60% opacity, so UV guide shows through)
              ctx.globalAlpha = 0.6
              ctx.drawImage(designImg, 0, 0, partSize, partSize)
              // Restore context state
              ctx.restore()
              resolve()
            }
            designImg.src = URL.createObjectURL(designBlob)
          })
          URL.revokeObjectURL(designImg.src)
        }
        
        return compositeCanvas.toDataURL('image/png')
      }

      // Helper function to safely format text (avoid special character issues)
      const safeText = (text: string) => text.replace(/[^\x00-\x7F]/g, (char) => {
        const map: Record<string, string> = {
          '–': '-', '—': '-', '×': 'x', '‑': '-'
        }
        return map[char] || char
      })

      for (let i = 0; i < parts.length; i++) {
        const { key, label } = parts[i]
        const dataUrl = await createCompositePart(key)

        if (i > 0) doc.addPage()
        
        const pageW = doc.internal.pageSize.getWidth()
        const pageH = doc.internal.pageSize.getHeight()
        
        // Header section
        doc.setFontSize(16)
        doc.setFont('helvetica', 'bold')
        const title = safeText(`T-Shirt Design - ${label}`)
        doc.text(title, pageW / 2, 15, { align: 'center' })
        
        // Size and style info
        doc.setFontSize(11)
        doc.setFont('helvetica', 'normal')
        const sizeText = garment.preset 
          ? `Size: ${garment.preset}` 
          : `Dimensions: ${(garment.custom?.widthIn??20).toFixed(1)} x ${(garment.custom?.lengthIn??28).toFixed(1)} in`
        const styleText = `Style: ${garment.style || 'regular'}`
        doc.text(safeText(sizeText), pageW / 2, 22, { align: 'center' })
        doc.text(safeText(styleText), pageW / 2, 27, { align: 'center' })
        
        // Measurements info (on first page only)
        if (i === 0) {
          doc.setFontSize(9)
          const measurementsText = `Measurements: H ${measurements.heightCm}cm | C ${measurements.chestCm}cm | W ${measurements.waistCm}cm | S ${measurements.shouldersCm}cm`
          doc.text(safeText(measurementsText), pageW / 2, 32, { align: 'center' })
        }
        
        // Image
        const maxW = pageW - 30 // 15mm margins
        const size = Math.min(maxW, 170)
        const x = (pageW - size) / 2
        const y = i === 0 ? 38 : 32 // More space on first page for measurements
        doc.addImage(dataUrl, 'PNG', x, y, size, size)
        
        // Footer
        doc.setFontSize(8)
        doc.setTextColor(128, 128, 128)
        const pageNum = `Page ${i + 1} of ${parts.length}`
        doc.text(pageNum, pageW / 2, pageH - 10, { align: 'center' })
        doc.setTextColor(0, 0, 0) // Reset to black
      }

      doc.save('shirt-design.pdf')
    } catch (err) {
      console.error('PDF export error:', err)
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('Cannot find module')) {
        alert('PDF export needs jsPDF. Please:\n\n1. Restart your dev server (stop and run "npm run dev" again)\n2. Then try the PDF export again.')
      } else {
        alert(`PDF export error: ${errorMessage}\n\nIf jsPDF is installed, try restarting your dev server.`)
      }
    }
  }, [shirtTexCanvas, sliceAtlasPart, garment, measurements])

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-2 h-screen">
      <div className="bg-gray-50 border-r h-[50vh] lg:h-full">
        <SceneCanvas ref={sceneRef}>
          <Mannequin />
        </SceneCanvas>
      </div>
      <aside className="p-3 sm:p-5 space-y-3 sm:space-y-5 bg-white h-[50vh] lg:h-full overflow-auto">
		<header className="space-y-2 sm:space-y-3">
			<div className="rounded-xl border bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 p-3 sm:p-4 text-white shadow">
				<div className="flex items-center justify-between gap-2 sm:gap-3">
					<h2 className="font-semibold text-base sm:text-lg">Step 3 · Review & Export</h2>
					<div className="hidden sm:flex items-center gap-1">
						<span className="px-2 py-1 text-[11px] rounded-full bg-white/15 border border-white/20">1 · Customize</span>
						<span className="px-2 py-1 text-[11px] rounded-full bg-white/15 border border-white/20">2 · Design</span>
						<span className="px-2 py-1 text-[11px] rounded-full bg-white text-black border border-white/20">3 · Review</span>
					</div>
				</div>
				<p className="text-xs text-white/90 mt-1 hidden sm:block">Preview your design, check fit, and export assets.</p>
				<p className="text-xs text-white/90 mt-1 sm:hidden">Review and export your design.</p>
			</div>
		</header>

		<section className="rounded-xl border p-4 space-y-3 bg-white/60 backdrop-blur">
			<h3 className="font-medium">Exports</h3>
			<p className="text-sm text-gray-600">Grab a polished snapshot or production-ready files.</p>
			<div className="grid sm:grid-cols-3 gap-2">
				<button
					onClick={handleDownloadPicture}
					className="px-3 py-2 rounded-md bg-black text-white flex items-center justify-center gap-2 hover:opacity-90 active:opacity-80"
					title="Download a picture of the 3D view"
				>
					<span>📸</span>
					<span>Picture (PNG)</span>
				</button>
				<button
					onClick={handleDownloadPNGs}
					disabled={!hasAtlas}
					className={`px-3 py-2 rounded-md flex items-center justify-center gap-2 ${hasAtlas ? 'bg-gray-900 text-white hover:opacity-90 active:opacity-80' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
					title="Download all flat slices (Front/Back/Sleeves)"
				>
					<span>🖼️</span>
					<span>All PNGs</span>
				</button>
				<button
					onClick={handleDownloadPDF}
					disabled={!hasAtlas}
					className={`px-3 py-2 rounded-md flex items-center justify-center gap-2 ${hasAtlas ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
					title="Export an A4 PDF with each part"
				>
					<span>📄</span>
					<span>PDF</span>
				</button>
			</div>
			{!hasAtlas && (
				<p className="text-[11px] text-red-600">No design atlas yet — open Design and add any element.</p>
			)}
			
			{/* Save to Gallery Button */}
			<div className="pt-2">
				<button
					onClick={handleSaveDesign}
					disabled={saving || (user !== null && !user)}
					className={`w-full px-4 py-2 rounded-md flex items-center justify-center gap-2 font-medium transition-all ${
						user 
							? saving 
								? 'bg-purple-400 text-white cursor-not-allowed' 
								: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 active:scale-95 shadow-lg'
							: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 active:scale-95 shadow-lg'
					}`}
					title={user ? 'Save your design to your gallery' : 'Click to sign in and save designs'}
				>
					<span>💾</span>
					<span>{saving ? 'Saving...' : user ? 'Save to Gallery' : 'Sign In to Save'}</span>
				</button>
				{!user && (
					<p className="text-[11px] text-gray-600 mt-1 text-center">
						Click to sign in and save your designs to the gallery.
					</p>
				)}
			</div>
		</section>

		<section className="rounded-xl border p-4 space-y-3">
			<h3 className="font-medium">Fit Status</h3>
			<div className="flex items-center gap-2">
				<span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${fit.status==='Perfect Fit'?'bg-green-100 text-green-700': fit.status==='Too Tight'?'bg-red-100 text-red-700':'bg-yellow-100 text-yellow-700'}`}>
					<span className="h-2 w-2 rounded-full bg-current" />
					{fit.status}
				</span>
				<span className="text-xs text-gray-500">Style: {garment.style}</span>
			</div>
			<ul className="text-sm text-gray-700 grid grid-cols-3 gap-2">
				<li className="rounded border p-2 text-center"><div className="text-[11px] text-gray-500">Chest diff</div><div className="font-semibold">{fit.diffChest.toFixed(1)} cm</div></li>
				<li className="rounded border p-2 text-center"><div className="text-[11px] text-gray-500">Waist diff</div><div className="font-semibold">{fit.diffWaist.toFixed(1)} cm</div></li>
				<li className="rounded border p-2 text-center"><div className="text-[11px] text-gray-500">Shoulders diff</div><div className="font-semibold">{fit.diffShoulders.toFixed(1)} cm</div></li>
			</ul>
		</section>

		<section className="rounded-xl border p-4 space-y-3">
			<h3 className="font-medium">Your Customizations</h3>
			<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
				<div className="rounded-lg border p-3 text-center">
					<div className="text-[11px] text-gray-500">Height</div>
					<div className="text-lg font-semibold">{measurements.heightCm.toFixed(0)} cm</div>
				</div>
				<div className="rounded-lg border p-3 text-center">
					<div className="text-[11px] text-gray-500">Chest</div>
					<div className="text-lg font-semibold">{measurements.chestCm.toFixed(0)} cm</div>
				</div>
				<div className="rounded-lg border p-3 text-center">
					<div className="text-[11px] text-gray-500">Waist</div>
					<div className="text-lg font-semibold">{measurements.waistCm.toFixed(0)} cm</div>
				</div>
				<div className="rounded-lg border p-3 text-center">
					<div className="text-[11px] text-gray-500">Shoulders</div>
					<div className="text-lg font-semibold">{measurements.shouldersCm.toFixed(0)} cm</div>
				</div>
				<div className="rounded-lg border p-3 text-center">
					<div className="text-[11px] text-gray-500">Arms (sleeve)</div>
					<div className="text-lg font-semibold">{measurements.sleeveCm.toFixed(0)} cm</div>
				</div>
			</div>
		</section>
      </aside>
    </div>
  )
}


