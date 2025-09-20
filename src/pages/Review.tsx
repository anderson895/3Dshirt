import Mannequin from '../components/Three/Mannequin'
import SceneCanvas, { SceneCanvasHandle } from '../components/Three/SceneCanva'
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
    const text = `H ${measurements.heightCm.toFixed(0)}cm • C ${measurements.chestCm.toFixed(0)}cm • W ${measurements.waistCm.toFixed(0)}cm • S ${measurements.shouldersCm.toFixed(0)}cm • Fit ${garment.style}`
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
      if (blob) downloadBlob(blob, `shirt-${p}.png`)
    }
  }, [shirtTexCanvas, sliceAtlasPart])

  const handleDownloadPDF = useCallback(async () => {
    if (!shirtTexCanvas) return
    try {
      // Lazy-load jsPDF. If not installed, a helpful alert is shown.
      const pkg = 'jspdf'
      // @vite-ignore prevents dev server from resolving it at transform time
      const mod = await import(/* @vite-ignore */ pkg) as any
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
        doc.text(`T‑Shirt Design – ${label}`, 105, 18, { align: 'center' })
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
    <div className="grid lg:grid-cols-2 h-[calc(100vh-0px)]">
      <div className="bg-gray-50 border-r">
        <SceneCanvas ref={sceneRef}>
          <Mannequin />
        </SceneCanvas>
      </div>
      <aside className="p-5 space-y-5 bg-white">
        <header className="space-y-1">
          <h2 className="font-semibold text-lg">Step 3 · Review & Export</h2>
          <p className="text-xs text-gray-500">Preview your design on the mannequin, check fit, and download.</p>
        </header>

        <div className="grid sm:grid-cols-2 gap-4">
          <section className="rounded border p-4 space-y-3">
            <h3 className="font-medium">Full Picture</h3>
            <p className="text-sm text-gray-600">Downloads a photo of the 3D mannequin with your shirt and sizes in the footer.</p>
            <button
              onClick={handleDownloadPicture}
              className="w-full px-3 py-2 rounded bg-black text-white"
            >
              Download Picture (PNG)
            </button>
          </section>

          <section className="rounded border p-4 space-y-3">
            <h3 className="font-medium">Front / Back Design</h3>
            <p className="text-sm text-gray-600">Downloads the flat design slices from the atlas.</p>
            {!hasAtlas && (
              <p className="text-xs text-red-600">No design atlas yet — make an edit in Design.</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={async()=>{ const b = await sliceAtlasPart('front'); if (b) downloadBlob(b, 'shirt-front.png') }}
                disabled={!hasAtlas}
                className={`px-3 py-2 rounded ${hasAtlas ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
              >
                Front PNG
              </button>
              <button
                onClick={async()=>{ const b = await sliceAtlasPart('back'); if (b) downloadBlob(b, 'shirt-back.png') }}
                disabled={!hasAtlas}
                className={`px-3 py-2 rounded ${hasAtlas ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
              >
                Back PNG
              </button>
            </div>
            <p className="text-[11px] text-gray-500">Sleeve downloads can be added if needed.</p>
          </section>
        </div>

        <section className="rounded border p-4 space-y-2">
          <h3 className="font-medium">Fit Status</h3>
          <div>
            <span className={`px-2 py-1 rounded ${fit.status==='Perfect Fit'?'bg-green-100 text-green-700': fit.status==='Too Tight'?'bg-red-100 text-red-700':'bg-yellow-100 text-yellow-700'}`}>{fit.status}</span>
          </div>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>Chest diff: {fit.diffChest.toFixed(1)} cm</li>
            <li>Waist diff: {fit.diffWaist.toFixed(1)} cm</li>
            <li>Shoulders diff: {fit.diffShoulders.toFixed(1)} cm</li>
          </ul>
        </section>
      </aside>
    </div>
  )
}


