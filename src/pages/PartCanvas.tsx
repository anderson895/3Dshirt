/* pages/PartCanvas.tsx */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Stage, Layer as KLayer, Rect, Text as KText, Image as KImage, Transformer, Group, Line, Circle } from 'react-konva'
import useImage from 'use-image'
import { useDesign, type ShirtPart, type Layer } from '../store/designStore'

export type PartCanvasHandle = { snapshot: () => HTMLCanvasElement | null }

const SIZE = 512
const SAFE_PAD = 24
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const coverFit = (w: number, h: number) => {
  const scale = Math.max(SIZE / w, SIZE / h)
  const nw = w * scale, nh = h * scale
  return { scale, x: Math.round((SIZE - nw) / 2), y: Math.round((SIZE - nh) / 2) }
}

type SelectableImageProps = {
  layer: Layer
  selected: boolean
  editingEnabled: boolean
  onSelect: () => void
  onChange: (patch: Partial<Layer>) => void
  onDirty?: () => void
}

function SelectableImage({ layer, selected, editingEnabled, onSelect, onChange, onDirty }: SelectableImageProps) {
  const [img] = useImage(layer.src || '', 'anonymous')
  const shapeRef = useRef<any>(null)
  const trRef = useRef<any>(null)
  const { updateLayer } = useDesign()

  React.useEffect(() => {
    if (!img) return
    if (layer.fitOnLoad) {
      const { scale, x, y } = coverFit(img.width, img.height)
      updateLayer(layer.id, { scale, x, y, fitOnLoad: false })
      onDirty?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img])

  React.useEffect(() => {
    if (editingEnabled && selected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current])
      trRef.current.getLayer()?.batchDraw()
    }
  }, [selected, editingEnabled])

  const handleTransform = () => {
    if (!editingEnabled) return
    const node = shapeRef.current
    const s = clamp((node.scaleX() + node.scaleY()) / 2, 0.1, 6)
    node.scaleX(s); node.scaleY(s)
    onChange({ scale: s, x: node.x(), y: node.y() })
    onDirty?.()
  }
  const handleTransformEnd = () => {
    if (!editingEnabled) return
    const node = shapeRef.current
    const s = clamp(node.scaleX(), 0.1, 6)
    onChange({ scale: s, x: node.x(), y: node.y() })
    onDirty?.()
  }

  return (
    <>
      <KImage
        ref={shapeRef}
        image={img as any}
        x={layer.x}
        y={layer.y}
        scaleX={layer.scale}
        scaleY={layer.scale}
        opacity={layer.opacity ?? 1}
        rotation={layer.rotation}
        draggable={editingEnabled}
        listening={editingEnabled}
        dragBoundFunc={(pos) => ({
          x: clamp(pos.x, -SIZE, SIZE),
          y: clamp(pos.y, -SIZE, SIZE),
        })}
        onDragMove={(e) => { if (!editingEnabled) return; onChange({ x: e.target.x(), y: e.target.y() }); onDirty?.() }}
        onDragEnd={(e) => { if (!editingEnabled) return; onChange({ x: e.target.x(), y: e.target.y() }); onDirty?.() }}
        onClick={() => { if (editingEnabled) onSelect() }}
        onTap={() => { if (editingEnabled) onSelect() }}
        onTransform={handleTransform}
        onTransformEnd={handleTransformEnd}
      />
      {selected && editingEnabled && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          anchorSize={14}
          borderStrokeWidth={1.5}
          enabledAnchors={[
            'top-left','top-right','bottom-left','bottom-right',
            'top-center','bottom-center','middle-left','middle-right',
          ]}
        />
      )}
    </>
  )
}

type SelectableTextProps = {
  layer: Layer
  selected: boolean
  editingEnabled: boolean
  onSelect: () => void
  onChange: (patch: Partial<Layer>) => void
  onDirty?: () => void
}
function SelectableText({ layer, selected, editingEnabled, onSelect, onChange, onDirty }: SelectableTextProps) {
  const shapeRef = useRef<any>(null)
  const trRef = useRef<any>(null)

  React.useEffect(() => {
    if (editingEnabled && selected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current])
      trRef.current.getLayer()?.batchDraw()
    }
  }, [selected, editingEnabled])

  const handleTransform = () => { if (editingEnabled) onDirty?.() }
  const handleTransformEnd = () => {
    if (!editingEnabled) return
    const node = shapeRef.current
    const sx = clamp(node.scaleX(), 0.1, 6)
    const newSize = clamp((layer.size || 28) * sx, 6, 400)
    node.scaleX(1); node.scaleY(1)
    onChange({ size: newSize, x: node.x(), y: node.y() })
    onDirty?.()
  }

  return (
    <>
      <KText
        ref={shapeRef}
        text={layer.text || ''}
        x={layer.x}
        y={layer.y}
        fontSize={layer.size || 28}
        fontFamily={layer.font || 'Arial'}
        fill={layer.color || '#111'}
        opacity={layer.opacity ?? 1}
        rotation={layer.rotation}
        draggable={editingEnabled}
        listening={editingEnabled}
        dragBoundFunc={(pos) => ({
          x: clamp(pos.x, -SIZE, SIZE),
          y: clamp(pos.y, -SIZE, SIZE),
        })}
        onDragMove={(e) => { if (!editingEnabled) return; onChange({ x: e.target.x(), y: e.target.y() }); onDirty?.() }}
        onDragEnd={(e) => { if (!editingEnabled) return; onChange({ x: e.target.x(), y: e.target.y() }); onDirty?.() }}
        onClick={() => { if (editingEnabled) onSelect() }}
        onTap={() => { if (editingEnabled) onSelect() }}
        onTransform={handleTransform}
        onTransformEnd={handleTransformEnd}
      />
      {selected && editingEnabled && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          anchorSize={12}
          borderStrokeWidth={1.5}
          enabledAnchors={[
            'top-left','top-right','bottom-left','bottom-right',
            'top-center','bottom-center','middle-left','middle-right',
          ]}
        />
      )}
    </>
  )
}

type SelectableShapeProps = {
  layer: Layer
  selected: boolean
  editingEnabled: boolean
  onSelect: () => void
  onChange: (patch: Partial<Layer>) => void
  onDirty?: () => void
}
function SelectableShape({ layer, selected, editingEnabled, onSelect, onChange, onDirty }: SelectableShapeProps) {
  const shapeRef = useRef<any>(null)
  const trRef = useRef<any>(null)
  const w = layer.w ?? 200
  const h = layer.h ?? 60
  const fill = layer.fill || '#ffffff'
  const stroke = layer.stroke || '#000000'
  const strokeWidth = layer.strokeWidth ?? 0

  React.useEffect(() => {
    if (editingEnabled && selected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current])
      trRef.current.getLayer()?.batchDraw()
    }
  }, [selected, editingEnabled])

  const handleTransform = () => { if (editingEnabled) onDirty?.() }
  const handleTransformEnd = () => {
    if (!editingEnabled) return
    const node = shapeRef.current
    const sx = clamp(node.scaleX(), 0.1, 6)
    const sy = clamp(node.scaleY(), 0.1, 6)
    node.scaleX(1); node.scaleY(1)
    onChange({ w: Math.round(w * sx), h: Math.round(h * sy), x: node.x(), y: node.y() })
    onDirty?.()
  }

  const commonProps = {
    ref: shapeRef,
    x: layer.x,
    y: layer.y,
    opacity: layer.opacity ?? 1,
    rotation: layer.rotation,
    draggable: editingEnabled,
    listening: editingEnabled,
    onClick: () => { if (editingEnabled) onSelect() },
    onTap: () => { if (editingEnabled) onSelect() },
    onTransform: handleTransform,
    onTransformEnd: handleTransformEnd,
  } as any

  return (
    <>
      {layer.shape === 'circle' ? (
        <Circle {...commonProps} radius={Math.max(w, h)/2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      ) : (
        <Rect {...commonProps} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={strokeWidth} cornerRadius={layer.shape==='stripe'?[0,0,0,0]:8} />
      )}
      {selected && editingEnabled && (
        <Transformer ref={trRef} rotateEnabled={false} anchorSize={12} borderStrokeWidth={1.5} />
      )}
    </>
  )
}

type SelectablePathProps = {
  layer: Layer
  selected: boolean
  editingEnabled: boolean
  onSelect: () => void
  onChange: (patch: Partial<Layer>) => void
  onDirty?: () => void
}
function SelectablePath({ layer, selected, editingEnabled, onSelect, onChange, onDirty }: SelectablePathProps) {
  const shapeRef = useRef<any>(null)
  const trRef = useRef<any>(null)
  const stroke = layer.stroke || '#000000'
  const strokeWidth = layer.strokeWidth ?? 4
  const points = layer.points || []

  React.useEffect(() => {
    if (editingEnabled && selected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current])
      trRef.current.getLayer()?.batchDraw()
    }
  }, [selected, editingEnabled])

  const handleTransform = () => { if (editingEnabled) onDirty?.() }
  const handleTransformEnd = () => {
    if (!editingEnabled) return
    const node = shapeRef.current
    const sx = clamp(node.scaleX(), 0.1, 6)
    const sy = clamp(node.scaleY(), 0.1, 6)
    node.scaleX(1); node.scaleY(1)
    onChange({ scale: Math.max(sx, sy), x: node.x(), y: node.y() })
    onDirty?.()
  }

  return (
    <>
      <Line
        ref={shapeRef}
        points={points}
        x={layer.x}
        y={layer.y}
        scaleX={layer.scale}
        scaleY={layer.scale}
        opacity={layer.opacity ?? 1}
        rotation={layer.rotation}
        stroke={stroke}
        strokeWidth={strokeWidth}
        lineCap="round"
        lineJoin="round"
        closed={!!layer.closed}
        draggable={editingEnabled}
        listening={editingEnabled}
        onClick={() => { if (editingEnabled) onSelect() }}
        onTap={() => { if (editingEnabled) onSelect() }}
        onTransform={handleTransform}
        onTransformEnd={handleTransformEnd}
      />
      {selected && editingEnabled && (
        <Transformer ref={trRef} rotateEnabled={false} anchorSize={12} borderStrokeWidth={1.5} />
      )}
    </>
  )
}

/** Visual guides (editor-only). Will be rendered on a separate Konva Layer. */
function GridOverlay({ showGrid, showSafe }:{ showGrid:boolean; showSafe:boolean }) {
  if (!showGrid && !showSafe) return null
  const lines = []
  if (showGrid) {
    const step = 64
    for (let i = step; i < SIZE; i += step) {
      lines.push(<Line key={`v-${i}`} points={[i,0,i,SIZE]} stroke="#e5e7eb" strokeWidth={1} dash={[4,4]} />)
      lines.push(<Line key={`h-${i}`} points={[0,i,SIZE,i]} stroke="#e5e7eb" strokeWidth={1} dash={[4,4]} />)
    }
    lines.push(<Line key="cx" points={[SIZE/2,0,SIZE/2,SIZE]} stroke="#d1d5db" strokeWidth={1} />)
    lines.push(<Line key="cy" points={[0,SIZE/2,SIZE,SIZE/2]} stroke="#d1d5db" strokeWidth={1} />)
  }
  return (
    <Group listening={false}>
      {lines}
      {showSafe && (
        <Rect
          x={SAFE_PAD} y={SAFE_PAD}
          width={SIZE - SAFE_PAD*2} height={SIZE - SAFE_PAD*2}
          stroke="#9ca3af" dash={[6,4]} strokeWidth={1}
        />
      )}
    </Group>
  )
}

const EmptyState = ({ part }:{part: ShirtPart}) => (
  <Group listening={false}>
    <Rect x={0} y={0} width={SIZE} height={SIZE} fillLinearGradientStartPoint={{x:0,y:0}} fillLinearGradientEndPoint={{x:0,y:SIZE}}
      fillLinearGradientColorStops={[0,'rgba(255,255,255,0)',1,'rgba(0,0,0,0.03)']} />
    <KText
      text={`No layers on ${part} yet.\n• Click “Upload Image” or “Add Text” above\n• Use Fit / Center to align\n• Scroll to zoom selected image`}
      x={SIZE/2 - 180}
      y={SIZE/2 - 40}
      width={360}
      align="center"
      fontSize={14}
      fill="#6b7280"
    />
  </Group>
)

type Props = {
  part: ShirtPart
  onDirty?: () => void
  showGrid?: boolean
  showSafe?: boolean
  drawMode?: boolean
}

const PartCanvas = forwardRef<PartCanvasHandle, Props>(({ part, onDirty, showGrid = true, showSafe = true, drawMode = false }, ref) => {
  const { layers, baseColor } = useDesign()
  const items = useMemo(() => layers.filter(l => l.part === part).sort((a, b) => a.z - b.z), [layers, part])

  const stageRef = useRef<any>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingEnabled, setEditingEnabled] = useState(true)

  const selectedLayer = useMemo(() => items.find(i => i.id === selectedId) ?? null, [items, selectedId])
  const drawingRef = useRef<{ id: string; points: number[] } | null>(null)

  useImperativeHandle(ref, () => ({
    snapshot: () => {
      const stage = stageRef.current
      if (!stage) return null

      // Hide overlay-only layer so guides are NOT captured in snapshot
      const overlay = stage.findOne('#overlay-layer')
      if (overlay) overlay.hide()

      stage.draw()
      const canvas = stage.toCanvas({ pixelRatio: 2 })

      if (overlay) overlay.show()
      return canvas
    },
  }))

  const update = useDesign.getState().updateLayer
  const remove = useDesign.getState().removeLayer

  const wheelZoom = (e: any) => {
    if (!editingEnabled) return
    if (!selectedLayer) return
    e.evt.preventDefault()
    if (selectedLayer.kind === 'image') {
      const dir = Math.sign(e.evt.deltaY)
      const factor = dir > 0 ? 0.92 : 1.08
      update(selectedLayer.id, { scale: clamp((selectedLayer.scale || 1) * factor, 0.1, 6) })
      onDirty?.()
    }
  }

  const fitSelected = () => {
    if (!editingEnabled) return
    if (!selectedLayer || selectedLayer.kind !== 'image') return
    const img = new Image()
    img.onload = () => {
      const { scale, x, y } = coverFit(img.width, img.height)
      update(selectedLayer.id, { scale, x, y })
      onDirty?.()
    }
    img.src = selectedLayer.src || ''
  }

  const centerSelected = () => {
    if (!editingEnabled || !selectedLayer) return
    if (selectedLayer.kind === 'image') {
      const img = new Image()
      img.onload = () => {
        const nw = (selectedLayer.scale || 1) * img.width
        const nh = (selectedLayer.scale || 1) * img.height
        const x = Math.round((SIZE - nw) / 2)
        const y = Math.round((SIZE - nh) / 2)
        update(selectedLayer.id, { x, y })
        onDirty?.()
      }
      img.src = selectedLayer.src || ''
    } else {
      const approxW = (selectedLayer.text?.length || 8) * Math.max((selectedLayer.size||28)*0.6, 8)
      const approxH = (selectedLayer.size||28)
      const x = Math.round((SIZE - approxW) / 2)
      const y = Math.round((SIZE - approxH) / 2)
      update(selectedLayer.id, { x, y })
      onDirty?.()
    }
  }

  const rotateSelected = () => {
    if (!editingEnabled || !selectedLayer) return
    update(selectedLayer.id, { rotation: ((selectedLayer.rotation || 0) + 90) % 360 })
    onDirty?.()
  }

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!editingEnabled || !selectedLayer) return
      const step = e.shiftKey ? 10 : 1
      if (e.key === 'Delete' || e.key === 'Backspace') {
        remove(selectedLayer.id); setSelectedId(null); onDirty?.()
      }
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
        e.preventDefault()
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        update(selectedLayer.id, { x: (selectedLayer.x||0)+dx, y: (selectedLayer.y||0)+dy })
        onDirty?.()
      }
      if ((e.key === '=' || e.key === '+') && selectedLayer.kind === 'image') {
        update(selectedLayer.id, { scale: clamp((selectedLayer.scale||1)*1.05, 0.1, 6) }); onDirty?.()
      }
      if (e.key === '-' && selectedLayer.kind === 'image') {
        update(selectedLayer.id, { scale: clamp((selectedLayer.scale||1)*0.95, 0.1, 6) }); onDirty?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editingEnabled, selectedLayer, onDirty, remove, update])

  const handleDone = () => {
    setSelectedId(null)
    setEditingEnabled(false)
  }
  const handleEdit = () => setEditingEnabled(true)
  const handleDeselect = () => setSelectedId(null)

  return (
    <div className="border rounded overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5 border-b bg-gray-50 text-xs">
        <div className="font-medium capitalize">{part}</div>

        {!editingEnabled && (
          <div className="flex items-center gap-2 text-gray-600">
            <span>Editing locked</span>
            <button className="px-2 py-0.5 border rounded bg-white hover:bg-gray-100" onClick={handleEdit}>Edit</button>
          </div>
        )}

        {editingEnabled && (
          <>
            {selectedLayer?.kind === 'image' && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1" title="Scale">
                  <button className="px-2 py-0.5 border rounded bg-white hover:bg-gray-100"
                          onClick={() => { if (!selectedLayer) return; useDesign.getState().updateLayer(selectedLayer.id, { scale: clamp((selectedLayer.scale||1)*0.9, 0.1, 6) }); onDirty?.() }}>
                    –
                  </button>
                  <input
                    type="range" min={0.1} max={6} step={0.01}
                    value={selectedLayer.scale}
                    onChange={(e) => { if (!selectedLayer) return; useDesign.getState().updateLayer(selectedLayer.id, { scale: clamp(parseFloat(e.target.value), 0.1, 6) }); onDirty?.() }}
                    className="w-28"
                  />
                  <button className="px-2 py-0.5 border rounded bg-white hover:bg-gray-100"
                          onClick={() => { if (!selectedLayer) return; useDesign.getState().updateLayer(selectedLayer.id, { scale: clamp((selectedLayer.scale||1)*1.1, 0.1, 6) }); onDirty?.() }}>
                    +
                  </button>
                </div>

                <button className="px-2 py-0.5 border rounded bg-white hover:bg-gray-100" onClick={fitSelected} title="Fill the square area">Fit Square</button>
                <button className="px-2 py-0.5 border rounded bg-white hover:bg-gray-100" onClick={centerSelected} title="Center on canvas">Center</button>
                <button className="px-2 py-0.5 border rounded bg-white hover:bg-gray-100" onClick={rotateSelected} title="Rotate 90°">Rotate 90°</button>

                <label className="block" title="Replace image">
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0]; if (!f || !selectedLayer) return
                      const url = URL.createObjectURL(f)
                      useDesign.getState().updateLayer(selectedLayer.id, { src: url, fitOnLoad: true, z: Date.now() })
                      onDirty?.()
                      e.currentTarget.value = ''
                    }}
                  />
                  <span className="px-2 py-0.5 border rounded cursor-pointer bg-white hover:bg-gray-100">Replace</span>
                </label>

                <button
                  className="px-2 py-0.5 border rounded bg-white hover:bg-gray-100"
                  onClick={() => { if (!selectedLayer) return; useDesign.getState().removeLayer(selectedLayer.id); setSelectedId(null); onDirty?.() }}
                  title="Delete this layer"
                >
                  Remove
                </button>
              </div>
            )}

            {selectedLayer?.kind === 'text' && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={selectedLayer.text || ''}
                  onChange={(e) => { useDesign.getState().updateLayer(selectedLayer.id, { text: e.target.value }); onDirty?.() }}
                  placeholder="Type your text"
                  className="px-2 py-0.5 border rounded w-44"
                  title="Edit text"
                />
                <label className="flex items-center gap-1" title="Font family">
                  <span>Font</span>
                  <select
                    className="border rounded px-1 py-0.5"
                    value={selectedLayer.font || 'Arial'}
                    onChange={(e)=>{ useDesign.getState().updateLayer(selectedLayer.id, { font: e.target.value }); onDirty?.() }}
                  >
                    {['Arial','Inter','Poppins','Montserrat','Roboto','Oswald','Bebas Neue','Anton','Lato','Nunito'].map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1" title="Font size">
                  <span>Size</span>
                  <input
                    type="number"
                    min={6}
                    max={400}
                    step={1}
                    value={selectedLayer.size || 28}
                    onChange={(e) => {
                      const v = clamp(parseInt(e.target.value || '0', 10), 6, 400)
                      useDesign.getState().updateLayer(selectedLayer.id, { size: v })
                      onDirty?.()
                    }}
                    className="w-16 px-1 py-0.5 border rounded"
                  />
                </label>
                <label className="flex items-center gap-1" title="Text color">
                  <span>Color</span>
                  <input
                    type="color"
                    value={selectedLayer.color || '#111111'}
                    onChange={(e) => { useDesign.getState().updateLayer(selectedLayer.id, { color: e.target.value }); onDirty?.() }}
                    className="h-6 w-8 p-0 border rounded"
                  />
                </label>
                <button className="px-2 py-0.5 border rounded bg-white hover:bg-gray-100" onClick={centerSelected} title="Center on canvas">Center</button>
                <button
                  className="px-2 py-0.5 border rounded bg-white hover:bg-gray-100"
                  onClick={() => { if (!selectedLayer) return; useDesign.getState().removeLayer(selectedLayer.id); setSelectedId(null); onDirty?.() }}
                  title="Delete this text"
                >
                  Remove
                </button>
              </div>
            )}

            {selectedLayer?.kind === 'shape' && (
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1" title="Shape">
                  <span>Type</span>
                  <select
                    className="border rounded px-1 py-0.5"
                    value={selectedLayer.shape || 'rect'}
                    onChange={(e)=>{ useDesign.getState().updateLayer(selectedLayer.id, { shape: e.target.value as any }); onDirty?.() }}
                  >
                    <option value="stripe">Stripe</option>
                    <option value="rect">Rectangle</option>
                    <option value="circle">Circle</option>
                  </select>
                </label>
                <label className="flex items-center gap-1" title="Fill color">
                  <span>Fill</span>
                  <input type="color" value={selectedLayer.fill || '#000000'} onChange={(e)=>{ useDesign.getState().updateLayer(selectedLayer.id, { fill: e.target.value }); onDirty?.() }} className="h-6 w-8 p-0 border rounded" />
                </label>
                <label className="flex items-center gap-1" title="Stroke color">
                  <span>Stroke</span>
                  <input type="color" value={selectedLayer.stroke || '#000000'} onChange={(e)=>{ useDesign.getState().updateLayer(selectedLayer.id, { stroke: e.target.value }); onDirty?.() }} className="h-6 w-8 p-0 border rounded" />
                </label>
                <label className="flex items-center gap-1" title="Stroke width">
                  <span>W</span>
                  <input type="number" className="w-14 px-1 py-0.5 border rounded" min={0} max={40} step={1} value={selectedLayer.strokeWidth ?? 0}
                         onChange={(e)=>{ useDesign.getState().updateLayer(selectedLayer.id, { strokeWidth: Number(e.target.value) }); onDirty?.() }} />
                </label>
                <button
                  className="px-2 py-0.5 border rounded bg-white hover:bg-gray-100"
                  onClick={() => { if (!selectedLayer) return; useDesign.getState().updateLayer(selectedLayer.id, { rotation: ((selectedLayer.rotation || 0) + 15) % 360 }); onDirty?.() }}
                  title="Rotate 15°"
                >Rotate</button>
                <button className="px-2 py-0.5 border rounded bg-white hover:bg-gray-100" onClick={centerSelected} title="Center on canvas">Center</button>
                <button className="px-2 py-0.5 border rounded bg-white hover:bg-gray-100" onClick={() => { if (!selectedLayer) return; useDesign.getState().removeLayer(selectedLayer.id); setSelectedId(null); onDirty?.() }} title="Delete this shape">Remove</button>
              </div>
            )}
          </>
        )}

        <div className="flex items-center gap-2">
          {editingEnabled && (
            <>
              <button className="px-2 py-0.5 border rounded bg-white hover:bg-gray-100" title="Clear selection" onClick={handleDeselect}>Deselect</button>
              <button className="px-2 py-0.5 border rounded bg-emerald-600 text-white hover:brightness-95" title="Finish edits for this part" onClick={handleDone}>Done</button>
            </>
          )}
        </div>
      </div>

      {/* Canvas */}
      <Stage
        width={SIZE}
        height={SIZE}
        ref={stageRef}
        onWheel={wheelZoom}
        onMouseDown={(e) => {
          if (!editingEnabled) return
          const stage = e.target.getStage()
          if (drawMode) {
            if (!stage) return
            const pos = stage.getPointerPosition(); if (!pos) return
            const id = Math.random().toString(36).slice(2)
            const points = [pos.x, pos.y]
            useDesign.getState().addLayer({ id, kind: 'path', part, x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, points, stroke: '#000000', strokeWidth: 4, z: Date.now() })
            drawingRef.current = { id, points }
            onDirty?.()
            return
          }
          if (stage && e.target === stage) setSelectedId(null)
        }}
        onMouseMove={(e) => {
          if (!editingEnabled || !drawMode) return
          const drawing = drawingRef.current; if (!drawing) return
          const stage = e.target.getStage(); if (!stage) return
          const pos = stage.getPointerPosition(); if (!pos) return
          drawing.points.push(pos.x, pos.y)
          useDesign.getState().updateLayer(drawing.id, { points: drawing.points.slice() })
          onDirty?.()
        }}
        onMouseUp={() => { drawingRef.current = null }}
        onTouchStart={(e) => {
          if (!editingEnabled) return
          const stage = e.target.getStage()
          if (drawMode) {
            if (!stage) return
            const pos = stage.getPointerPosition(); if (!pos) return
            const id = Math.random().toString(36).slice(2)
            const points = [pos.x, pos.y]
            useDesign.getState().addLayer({ id, kind: 'path', part, x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, points, stroke: '#000000', strokeWidth: 4, z: Date.now() })
            drawingRef.current = { id, points }
            onDirty?.()
            return
          }
          if (stage && e.target === stage) setSelectedId(null)
        }}
        onTouchMove={(e) => {
          if (!editingEnabled || !drawMode) return
          const drawing = drawingRef.current; if (!drawing) return
          const stage = e.target.getStage(); if (!stage) return
          const pos = stage.getPointerPosition(); if (!pos) return
          drawing.points.push(pos.x, pos.y)
          useDesign.getState().updateLayer(drawing.id, { points: drawing.points.slice() })
          onDirty?.()
        }}
        onTouchEnd={() => { drawingRef.current = null }}
        className="bg-white"
        style={{ cursor: editingEnabled ? (drawMode ? 'crosshair' : 'move') : 'default' }}
      >
        {/* CONTENT LAYER — this is what snapshot() captures */}
        <KLayer>
          <Rect x={0} y={0} width={SIZE} height={SIZE} fill={baseColor} />

          {items.length === 0 && <EmptyState part={part} />}

          {items.map(l =>
            l.kind === 'text' ? (
              <SelectableText
                key={l.id}
                layer={l}
                selected={selectedId === l.id}
                editingEnabled={editingEnabled}
                onSelect={() => setSelectedId(l.id)}
                onChange={(patch) => useDesign.getState().updateLayer(l.id, patch)}
                onDirty={onDirty}
              />
          ) : l.kind === 'image' ? (
              <SelectableImage
                key={l.id}
                layer={l}
                selected={selectedId === l.id}
                editingEnabled={editingEnabled}
                onSelect={() => setSelectedId(l.id)}
                onChange={(patch) => useDesign.getState().updateLayer(l.id, patch)}
                onDirty={onDirty}
              />
          ) : l.kind === 'path' ? (
              <SelectablePath
                key={l.id}
                layer={l}
                selected={selectedId === l.id}
                editingEnabled={editingEnabled}
                onSelect={() => setSelectedId(l.id)}
                onChange={(patch) => useDesign.getState().updateLayer(l.id, patch)}
                onDirty={onDirty}
              />
          ) : (
            <SelectableShape
              key={l.id}
              layer={l}
              selected={selectedId === l.id}
              editingEnabled={editingEnabled}
              onSelect={() => setSelectedId(l.id)}
              onChange={(patch) => useDesign.getState().updateLayer(l.id, patch)}
              onDirty={onDirty}
            />
            ),
          )}
        </KLayer>

        {/* OVERLAY-ONLY LAYER — excluded from snapshot by temporarily hiding it */}
        {(showGrid || showSafe) && (
          <KLayer listening={false} id="overlay-layer">
            <GridOverlay showGrid={!!showGrid} showSafe={!!showSafe} />
          </KLayer>
        )}
      </Stage>

      <div className="flex items-center justify-between px-2 py-1 text-[11px] text-gray-500 border-t bg-white">
        <div>Tip: Arrow keys nudge • Shift+Arrows = x10 • Delete to remove</div>
        <div>Canvas: {SIZE}×{SIZE} • Safe: {SIZE - SAFE_PAD*2}×{SIZE - SAFE_PAD*2}</div>
      </div>
    </div>
  )
})
PartCanvas.displayName = 'PartCanvas'
export default PartCanvas
