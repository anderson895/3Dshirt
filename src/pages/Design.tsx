/* pages/DesignPage.tsx */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { nanoid } from 'nanoid'
import { useDesign } from '../store/designStore'
import Mannequin from '../components/Three/Mannequin'
import type { PartCanvasHandle } from './PartCanvas'
import PartCanvas from './PartCanvas'
import SceneCanvas from '../components/Three/SceneCanva'

function UploadButton({ part }: { part: 'front'|'back'|'sleeveL'|'sleeveR' }) {
  const { addLayer, updateLayer, removeLayer, layers } = useDesign()
  const existingImage = useMemo(
    () => layers.find(l => l.part === part && l.kind === 'image'),
    [layers, part]
  )

  return (
    <div className="flex items-center gap-2">
      <label className="block" title="Upload a new image for this part">
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]; if (!f) return
            const url = URL.createObjectURL(f)
            if (existingImage) {
              updateLayer(existingImage.id, { src: url, fitOnLoad: true, z: Date.now() })
            } else {
              addLayer({
                id: nanoid(),
                kind: 'image',
                part,
                x: 0, y: 0,
                scale: 1,
                rotation: 0,
                opacity: 1,
                src: url,
                fitOnLoad: true,
                z: Date.now(),
              })
            }
            e.currentTarget.value = ''
          }}
        />
        <span className="px-3 py-1.5 border rounded cursor-pointer hover:bg-gray-50">
          {existingImage ? 'Replace Image' : 'Upload Image'}
        </span>
      </label>

      {existingImage && (
        <button
          className="px-3 py-1.5 border rounded hover:bg-gray-50"
          onClick={() => removeLayer(existingImage.id)}
          title="Remove current image"
        >
          Remove Image
        </button>
      )}
    </div>
  )
}

const QUICK_COLORS = ['#111111','#ffffff','#f87171','#34d399','#60a5fa','#fbbf24','#a78bfa','#f472b6']

export default function DesignPage() {
  const nav = useNavigate()
  const { addLayer, setShirtTexCanvas, bumpShirtTexStamp, baseColor, setBaseColor, layers, garment, setGarment } = useDesign()
  const [part, setPart] = useState<'front'|'back'|'sleeveL'|'sleeveR'>('front')

  const [showGrid, setShowGrid] = useState(true)
  const [showSafe, setShowSafe] = useState(true)

  const frontRef = useRef<PartCanvasHandle>(null)
  const backRef  = useRef<PartCanvasHandle>(null)
  const slRef    = useRef<PartCanvasHandle>(null)
  const srRef    = useRef<PartCanvasHandle>(null)

  const atlasRef = useRef<HTMLCanvasElement | null>(null)

  const ensureAtlas = () => {
    if (!atlasRef.current) {
      const c = document.createElement('canvas')
      c.width = 2048; c.height = 2048
      atlasRef.current = c
      setShirtTexCanvas(c)
    }
    return atlasRef.current!
  }

  const rebuildAtlas = () => {
    const atlas = ensureAtlas()
    const ctx = atlas.getContext('2d')!
    ctx.clearRect(0, 0, atlas.width, atlas.height)

    const drawAt = (c: HTMLCanvasElement | null, x: number, y: number) => { if (c) ctx.drawImage(c, x, y, 1024, 1024) }

    const cFront = frontRef.current?.snapshot() ?? null
    const cBack  = backRef.current?.snapshot() ?? null
    const cSL    = slRef.current?.snapshot() ?? null
    const cSR    = srRef.current?.snapshot() ?? null

    drawAt(cFront, 0, 0)
    drawAt(cBack, 1024, 0)
    drawAt(cSL, 0, 1024)
    drawAt(cSR, 1024, 1024)

    bumpShirtTexStamp()
  }

  const throttleTimer = useRef<number | null>(null)
  const scheduleRebuild = () => {
    if (throttleTimer.current !== null) return
    throttleTimer.current = window.setTimeout(() => {
      throttleTimer.current = null
      rebuildAtlas()
    }, 60)
  }

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null)
  const forceRefreshNow = () => {
    setIsRefreshing(true)
    try {
      rebuildAtlas()
      setLastRefreshAt(Date.now())
    } finally {
      setTimeout(() => setIsRefreshing(false), 150)
    }
  }

  useEffect(() => {
    scheduleRebuild()
    return () => { if (throttleTimer.current) clearTimeout(throttleTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { scheduleRebuild() }, [layers, baseColor])

  const Step = ({ n, label }: { n: number; label: string }) => (
    <div className="flex items-center gap-2">
      <div className="h-6 w-6 rounded-full bg-black text-white grid place-items-center text-xs">{n}</div>
      <div className="text-sm">{label}</div>
    </div>
  )

  return (
    <div className="grid grid-cols-2 h-full">
      <div className="relative bg-gray-50 h-screen sticky top-0">
        <SceneCanvas>
          <Mannequin />
        </SceneCanvas>
        <div className="absolute left-3 top-3 flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 border">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live updating
          </span>
          {lastRefreshAt && (
            <span className="rounded-full bg-white/90 px-2 py-1 border">Last refresh {new Date(lastRefreshAt).toLocaleTimeString()}</span>
          )}
        </div>
      </div>

      <aside className="p-4 space-y-4 overflow-auto border-l bg-white">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg">T-Shirt Designer</h2>
            <p className="text-xs text-gray-500">Design per part → texture atlas → live 3D preview</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={forceRefreshNow}
              disabled={isRefreshing}
              className={`px-3 py-1.5 rounded border ${isRefreshing ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-50'}`}
              title="Force rebuild the 3D preview texture"
            >
              {isRefreshing ? 'Refreshing…' : 'Refresh 3D Preview'}
            </button>
            <button
              onClick={() => nav('/review')}
              className="px-3 py-1.5 rounded bg-black text-white"
              title="Go to Step 3: Review & Export"
            >
              Step 3: Review & Export
            </button>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 bg-gray-50 border rounded p-3">
          <Step n={1} label="Choose a part (Front, Back, Sleeves)" />
          <Step n={2} label="Upload image or add text" />
          <Step n={3} label="Drag/scale; use Fit/Center guides" />
          <Step n={4} label="Adjust shirt color & size; preview in 3D" />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {(['front','back','sleeveL','sleeveR'] as const).map(p => (
            <button
              key={p}
              onClick={()=>setPart(p)}
              className={`px-3 py-1.5 rounded border transition ${
                part===p ? 'bg-black text-white border-black' : 'hover:bg-gray-50'
              }`}
              title={`Edit ${p}`}
            >
              {p === 'front'   && '👕 Front'}
              {p === 'back'    && '🧥 Back'}
              {p === 'sleeveL' && '🫲 Left Sleeve'}
              {p === 'sleeveR' && '🫱 Right Sleeve'}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <label className="text-sm">Shirt color</label>
            <input
              type="color"
              value={baseColor}
              onChange={(e) => setBaseColor(e.target.value)}
              className="h-8 w-10 p-0 border rounded"
              title="Pick T-shirt color"
            />
            <div className="flex gap-1">
              {QUICK_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setBaseColor(c)}
                  className="h-6 w-6 rounded border"
                  style={{ background: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap text-sm">
          <UploadButton part={part} />
          <button
            className="px-3 py-1.5 border rounded hover:bg-gray-50"
            title="Insert editable text"
            onClick={() => addLayer({
              id: nanoid(), kind: 'text', part,
              x: 176, y: 238, scale: 1, rotation: 0, opacity: 1,
              text: 'Your Text', size: 36, color: '#ffffff', z: Date.now(),
            })}
          >
            Add Text
          </button>

          <div className="ml-auto flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-black" checked={showGrid} onChange={e=>setShowGrid(e.target.checked)} />
              Grid
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-black" checked={showSafe} onChange={e=>setShowSafe(e.target.checked)} />
              Safe-area
            </label>
          </div>
        </div>

        <section className="rounded border p-3 space-y-3">
          <h3 className="font-medium">Size & fit</h3>
          <div className="flex flex-wrap gap-3 items-center text-sm">
            <label className="inline-flex items-center gap-2">
              <span>Preset</span>
              <select
                className="border rounded px-2 py-1"
                value={garment.preset ?? 'M'}
                onChange={(e)=> setGarment({ preset: e.target.value as any })}
              >
                {['S','M','L','XL'].map(p => (<option key={p} value={p}>{p}</option>))}
              </select>
            </label>
            <label className="inline-flex items-center gap-2">
              <span>Style</span>
              <select
                className="border rounded px-2 py-1"
                value={garment.style}
                onChange={(e)=> setGarment({ style: e.target.value as any })}
              >
                {['fit','regular','loose'].map(s => (<option key={s} value={s}>{s}</option>))}
              </select>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="accent-black"
                checked={!!garment.useMorphOnly}
                onChange={(e)=> setGarment({ useMorphOnly: e.target.checked })}
              />
              <span>Match Blender (morphs only)</span>
            </label>
          </div>

          <div className={`grid grid-cols-2 gap-4 text-sm ${garment.useMorphOnly ? 'opacity-50 pointer-events-none' : ''}`}>
            <div>
              <label className="flex items-center justify-between mb-1">
                <span>Width (in)</span>
                <span className="tabular-nums">{(garment.custom?.widthIn ?? 20).toFixed(1)}</span>
              </label>
              <input
                type="range"
                min={17}
                max={24}
                step={0.1}
                className="w-full"
                value={garment.custom?.widthIn ?? 20}
                onChange={(e)=> setGarment({ custom: { ...(garment.custom ?? {}), widthIn: Number(e.target.value) } })}
              />
            </div>
            <div>
              <label className="flex items-center justify-between mb-1">
                <span>Length (in)</span>
                <span className="tabular-nums">{(garment.custom?.lengthIn ?? 28).toFixed(1)}</span>
              </label>
              <input
                type="range"
                min={24}
                max={33}
                step={0.1}
                className="w-full"
                value={garment.custom?.lengthIn ?? 28}
                onChange={(e)=> setGarment({ custom: { ...(garment.custom ?? {}), lengthIn: Number(e.target.value) } })}
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">Presets give a starting point. Use sliders for fine-tuning.</p>
        </section>

        <details className="rounded border p-3 text-sm text-gray-700 bg-gray-50" open>
          <summary className="font-medium cursor-pointer select-none">Quick tips</summary>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Scroll to zoom selected image; hold <kbd>Shift</kbd> for bigger keyboard nudges.</li>
            <li>Use <strong>Fit Square</strong> to cover, or <strong>Center</strong> to align.</li>
            <li><kbd>Delete</kbd> removes the selected layer. Arrow keys nudge position.</li>
          </ul>
        </details>

        <div className="grid grid-cols-2 gap-3">
          <PartCanvas ref={frontRef} part="front"   onDirty={scheduleRebuild} showGrid={showGrid} showSafe={showSafe} />
          <PartCanvas ref={backRef}  part="back"    onDirty={scheduleRebuild} showGrid={showGrid} showSafe={showSafe} />
          <PartCanvas ref={slRef}    part="sleeveL" onDirty={scheduleRebuild} showGrid={showGrid} showSafe={showSafe} />
          <PartCanvas ref={srRef}    part="sleeveR" onDirty={scheduleRebuild} showGrid={showGrid} showSafe={showSafe} />
        </div>
      </aside>
    </div>
  )
}
