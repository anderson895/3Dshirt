/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import Mannequin from '../components/Three/Mannequin'
import SceneCanvas, { type SceneCanvasHandle } from '../components/Three/SceneCanva'
import { useDesign } from '../store/designStore'
import { computeFit } from '../utils/fit'
import { useCallback, useRef } from 'react'

export default function Review() {
  const { measurements, garment, shirtTexCanvas } = useDesign()
  const fit = computeFit(measurements, garment)

  const hasAtlas = !!shirtTexCanvas

  const sceneRef = useRef<SceneCanvasHandle | null>(null)

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
    const parts: Array<'front'|'back'|'sleeveL'|'sleeveR'> = ['front','back','sleeveL','sleeveR']
    for (const p of parts) {
      const blob = await sliceAtlasPart(p)
      if (blob) {
        const sizeLabel = garment.preset ? garment.preset : `${(garment.custom?.widthIn??20).toFixed(0)}x${(garment.custom?.lengthIn??28).toFixed(0)}in`
        downloadBlob(blob, `shirt-${p}-${sizeLabel}.png`)
      }
    }
  }, [shirtTexCanvas, sliceAtlasPart])

  const handleDownloadPDF = useCallback(async () => {
    if (!shirtTexCanvas) return
    try {
      // Lazy-load jsPDF. If not installed, a helpful alert is shown.
      const pkg = 'jspdf'
      // @vite-ignore prevents dev server from resolving it at transform time
      const mod = await import(/* @vite-ignore */ pkg) as any;
      const jsPDF = mod.jsPDF || mod.default
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })

      const parts: Array<{ key:'front'|'back'|'sleeveL'|'sleeveR'; label: string }> = [
        { key: 'front', label: 'Front' },
        { key: 'back', label: 'Back' },
        { key: 'sleeveL', label: 'Left Sleeve' },
        { key: 'sleeveR', label: 'Right Sleeve' },
      ]

      for (let i = 0; i < parts.length; i++) {
        const { key, label } = parts[i]
        const blob = await sliceAtlasPart(key)
        if (!blob) continue
        const dataUrl = await new Promise<string>((resolve) => {
          const fr = new FileReader()
          fr.onload = () => resolve(fr.result as string)
          fr.readAsDataURL(blob)
        })

        if (i > 0) doc.addPage()
        // Simple layout: title + square image centered
        doc.setFontSize(14)
        const sz = garment.preset ? `Size ${garment.preset}` : `${(garment.custom?.widthIn??20).toFixed(1)}×${(garment.custom?.lengthIn??28).toFixed(1)} in`
        doc.text(`T‑Shirt Design – ${label} – ${sz}`, 105, 18, { align: 'center' })
        const pageW = doc.internal.pageSize.getWidth()
        const maxW = pageW - 30 // 15mm margins
        const size = Math.min(maxW, 170)
        const x = (pageW - size) / 2
        const y = 28
        doc.addImage(dataUrl, 'PNG', x, y, size, size)
      }

      doc.save('shirt-design.pdf')
    } catch (err) {
      console.warn('PDF export requires jsPDF. Install with: npm i jspdf', err)
      alert('PDF export needs jsPDF. Please run:\n\n  npm i jspdf\n\nThen try again.')
    }
  }, [shirtTexCanvas, sliceAtlasPart])

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


