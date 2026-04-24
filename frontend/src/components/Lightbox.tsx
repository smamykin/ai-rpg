import { useEffect, useCallback } from 'react'
import { X, Pin, ChevronLeft, ChevronRight } from 'lucide-react'
import type { GalleryImage } from '../types'

interface Props {
  images: GalleryImage[]
  index: number
  onClose: () => void
  onNavigate: (index: number) => void
  onDelete?: (id: string) => void
  pinnedBgId?: string | null
  onSetBg?: (id: string | null) => void
}

export default function Lightbox({ images, index, onClose, onNavigate, onDelete, pinnedBgId, onSetBg }: Props) {
  const img = images[index]
  const hasPrev = index > 0
  const hasNext = index < images.length - 1

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && hasPrev) onNavigate(index - 1)
      if (e.key === 'ArrowRight' && hasNext) onNavigate(index + 1)
    },
    [onClose, onNavigate, index, hasPrev, hasNext]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [handleKey])

  if (!img) return null

  const download = () => {
    const a = document.createElement('a')
    a.href = img.url
    a.download = `rpg_${img.id}.png`
    a.target = '_blank'
    a.click()
  }

  return (
    <div className="lbx" onClick={onClose}>
      <button className="b bs lbx-cl" onClick={onClose} aria-label="Close"><X size={18} className="ic" /></button>

      {hasPrev && (
        <button
          className="lbx-nav lbx-prev"
          onClick={e => { e.stopPropagation(); onNavigate(index - 1) }}
          aria-label="Previous image"
        ><ChevronLeft size={28} className="ic" /></button>
      )}
      {hasNext && (
        <button
          className="lbx-nav lbx-next"
          onClick={e => { e.stopPropagation(); onNavigate(index + 1) }}
          aria-label="Next image"
        ><ChevronRight size={28} className="ic" /></button>
      )}

      <img
        className="lbx-img"
        src={img.url}
        alt={img.prompt}
        onClick={e => e.stopPropagation()}
      />

      {img.prompt && <div className="lbx-pr">{img.prompt}</div>}

      <div className="lbx-act" onClick={e => e.stopPropagation()}>
        <button className="b bs" onClick={download}>Download</button>
        {onSetBg && (
          pinnedBgId === img.id ? (
            <button className="b bs ba" onClick={() => onSetBg(null)}><Pin size={14} className="ic" fill="currentColor" /> Pinned</button>
          ) : (
            <button className="b bs" onClick={() => onSetBg(img.id)}><Pin size={14} className="ic ic-pin" /> Pin as BG</button>
          )
        )}
        {onDelete && (
          <button
            className="b bs"
            style={{ color: 'var(--dng)' }}
            onClick={() => { onDelete(img.id); onClose() }}
          >Delete</button>
        )}
      </div>
    </div>
  )
}
