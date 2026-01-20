import './ImageViewer.css'

interface ImageViewerProps {
  imageUrl: string | null
  onClose: () => void
  title?: string
}

export default function ImageViewer({ imageUrl, onClose, title }: ImageViewerProps) {
  if (!imageUrl) return null

  return (
    <div className="image-viewer-overlay" onClick={onClose}>
      <div className="image-viewer-content" onClick={(e) => e.stopPropagation()}>
        <button className="image-viewer-close" onClick={onClose}>
          ✕
        </button>
        {title && <h3 className="image-viewer-title">{title}</h3>}
        <div className="image-viewer-image-container">
          <img src={imageUrl} alt={title || 'Full size preview'} />
        </div>
      </div>
    </div>
  )
}


