/* utils/renderLayersToCanvas.ts */
/* Utility to render layers directly to canvas without PartCanvas */
import type { Layer, ShirtPart } from '../store/designStore'


// Atlas quadrant positions
const QUADRANT_POSITIONS: Record<ShirtPart, { x: number; y: number }> = {
  front: { x: 0, y: 0 },
  back: { x: 1024, y: 0 },
  sleeveL: { x: 0, y: 1024 },
  sleeveR: { x: 1024, y: 1024 },
}

/**
 * Render a single layer to a canvas context
 */
async function renderLayer(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  quadrantX: number,
  quadrantY: number
): Promise<void> {
  ctx.save()

  // PartCanvas uses 512x512, but snapshot is taken at pixelRatio: 2, so it becomes 1024x1024
  // Layer coordinates are in 512x512 space, so we multiply by 2 for atlas
  const x = quadrantX + (layer.x * 2)
  const y = quadrantY + (layer.y * 2)
  const scale = (layer.scale || 1)
  const rotation = (layer.rotation || 0) * (Math.PI / 180)
  const opacity = layer.opacity ?? 1

  ctx.globalAlpha = opacity
  
  // Set transform origin to center of layer, then apply transforms
  // We'll adjust based on the layer type

  if (layer.kind === 'image' && layer.src) {
    // Render image layer
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        // Image dimensions in 512x512 space, scale up to 1024x1024 atlas
        const width = img.width * scale * 2
        const height = img.height * scale * 2
        
        // Apply rotation if needed
        if (rotation !== 0) {
          const centerX = x + width / 2
          const centerY = y + height / 2
          ctx.translate(centerX, centerY)
          ctx.rotate(rotation)
          ctx.translate(-centerX, -centerY)
        }
        
        ctx.drawImage(img, x, y, width, height)
        ctx.restore()
        resolve()
      }
      img.onerror = () => {
        ctx.restore()
        resolve()
      }
      img.src = layer.src!
    })
  } else if (layer.kind === 'text' && layer.text) {
    // Render text layer
    const fontSize = (layer.size || 28) * 2 * scale // Scale from 512 to 1024 space
    const font = layer.font || 'Arial'
    const color = layer.color || '#000000'
    
    ctx.font = `bold ${fontSize}px ${font}`
    ctx.fillStyle = color
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    
    // Apply rotation if needed
    if (rotation !== 0) {
      const centerX = x
      const centerY = y
      ctx.translate(centerX, centerY)
      ctx.rotate(rotation)
      ctx.translate(-centerX, -centerY)
    }
    
    // Split text by lines if needed
    const lines = layer.text.split('\n')
    lines.forEach((line, i) => {
      ctx.fillText(line, x, y + (i * fontSize * 1.2))
    })
    
    ctx.restore()
    return Promise.resolve()
  } else if (layer.kind === 'shape') {
    // Render shape layer
    const width = (layer.w || 100) * 2 * scale // Scale to atlas size
    const height = (layer.h || 100) * 2 * scale
    const fill = layer.fill || '#000000'
    const stroke = layer.stroke || '#000000'
    const strokeWidth = (layer.strokeWidth || 0) * 2
    
    // Apply rotation if needed
    if (rotation !== 0) {
      const centerX = x + width / 2
      const centerY = y + height / 2
      ctx.translate(centerX, centerY)
      ctx.rotate(rotation)
      ctx.translate(-centerX, -centerY)
    }
    
    ctx.fillStyle = fill
    if (strokeWidth > 0) {
      ctx.strokeStyle = stroke
      ctx.lineWidth = strokeWidth
    }

    if (layer.shape === 'rect' || layer.shape === 'stripe') {
      ctx.fillRect(x, y, width, height)
      if (strokeWidth > 0) {
        ctx.strokeRect(x, y, width, height)
      }
    } else if (layer.shape === 'circle') {
      const radius = Math.min(width, height) / 2
      ctx.beginPath()
      ctx.arc(x + width / 2, y + height / 2, radius, 0, Math.PI * 2)
      ctx.fill()
      if (strokeWidth > 0) {
        ctx.stroke()
      }
    }
    
    ctx.restore()
    return Promise.resolve()
  } else if (layer.kind === 'path' && layer.points) {
    // Render path layer (freehand drawing)
    const points = layer.points
    if (points.length < 2) {
      ctx.restore()
      return Promise.resolve()
    }

    ctx.strokeStyle = layer.stroke || '#000000'
    ctx.lineWidth = (layer.strokeWidth || 2) * 2 * scale
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    
    // Apply rotation if needed
    if (rotation !== 0) {
      // Calculate center of path
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (let i = 0; i < points.length; i += 2) {
        minX = Math.min(minX, points[i])
        minY = Math.min(minY, points[i + 1])
        maxX = Math.max(maxX, points[i])
        maxY = Math.max(maxY, points[i + 1])
      }
      const centerX = quadrantX + ((minX + maxX) / 2) * 2
      const centerY = quadrantY + ((minY + maxY) / 2) * 2
      ctx.translate(centerX, centerY)
      ctx.rotate(rotation)
      ctx.translate(-centerX, -centerY)
    }
    
    ctx.beginPath()
    for (let i = 0; i < points.length; i += 2) {
      const px = quadrantX + (points[i] * 2)
      const py = quadrantY + (points[i + 1] * 2)
      if (i === 0) {
        ctx.moveTo(px, py)
      } else {
        ctx.lineTo(px, py)
      }
    }
    
    if (layer.closed) {
      ctx.closePath()
      if (layer.fill) {
        ctx.fillStyle = layer.fill
        ctx.fill()
      }
    }
    ctx.stroke()
    
    ctx.restore()
    return Promise.resolve()
  }

  // Fallback: restore context if layer type wasn't handled
  ctx.restore()
  return Promise.resolve()
}

/**
 * Rebuild the shirt texture atlas from layers
 */
export async function renderLayersToCanvas(
  canvas: HTMLCanvasElement,
  layers: Layer[],
  baseColor: string
): Promise<void> {
  const ctx = canvas.getContext('2d')!
  if (!ctx) return

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Fill each quadrant with base color
  ctx.fillStyle = baseColor
  ctx.fillRect(0, 0, 1024, 1024) // Front
  ctx.fillRect(1024, 0, 1024, 1024) // Back
  ctx.fillRect(0, 1024, 1024, 1024) // Sleeve L
  ctx.fillRect(1024, 1024, 1024, 1024) // Sleeve R

  // Group layers by part and sort by z-index
  const layersByPart: Record<ShirtPart, Layer[]> = {
    front: [],
    back: [],
    sleeveL: [],
    sleeveR: [],
  }

  layers.forEach((layer) => {
    if (layersByPart[layer.part]) {
      layersByPart[layer.part].push(layer)
    }
  })

  // Sort each part's layers by z-index
  Object.keys(layersByPart).forEach((part) => {
    layersByPart[part as ShirtPart].sort((a, b) => a.z - b.z)
  })

  // Render each part's layers
  const renderPromises: Promise<void>[] = []

  Object.entries(layersByPart).forEach(([part, partLayers]) => {
    const quadrantPos = QUADRANT_POSITIONS[part as ShirtPart]
    
    partLayers.forEach((layer) => {
      renderPromises.push(
        renderLayer(ctx, layer, quadrantPos.x, quadrantPos.y)
      )
    })
  })

  // Wait for all layers to render (especially images which load asynchronously)
  await Promise.all(renderPromises)
}

