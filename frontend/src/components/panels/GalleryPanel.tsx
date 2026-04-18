import { useState } from 'react'
import type { GalleryImage } from '../../types'
import Lightbox from '../Lightbox'

interface Props {
  show: boolean
  onClose: () => void
  images: GalleryImage[]
  onNewImage: () => void
  onDelete: (id: string) => void
  onClearAll: () => void
}

type Filter = 'all' | 'story' | 'lore'

export default function GalleryPanel({ show, onClose, images, onNewImage, onDelete, onClearAll }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [lbIdx, setLbIdx] = useState<number | null>(null)
  const [cfmClear, setCfmClear] = useState(false)

  const filtered = filter === 'all' ? images : images.filter(i => i.source === filter)

  const download = (img: GalleryImage) => {
    const a = document.createElement('a')
    a.href = img.url
    a.download = `rpg_${img.id}.png`
    a.target = '_blank'
    a.click()
  }

  return (
    <>
      <div className={`ov ${show ? 'o' : ''}`} onClick={onClose} />
      <div className={`pn ${show ? 'o' : ''}`}>
        <div className="ph">
          <span>Gallery</span>
          <button className="b bs" onClick={onClose}>&#x2715;</button>
        </div>

        <button className="b ba" style={{ width: '100%', marginBottom: '.6rem' }} onClick={onNewImage}>
          + New Image
        </button>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '.3rem', marginBottom: '.6rem' }}>
          {(['all', 'story', 'lore'] as Filter[]).map(f => (
            <button
              key={f}
              className={`b bs${filter === f ? ' ba' : ''}`}
              onClick={() => setFilter(f)}
            >{f.charAt(0).toUpperCase() + f.slice(1)}</button>
          ))}
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--mt)', fontSize: '.85rem' }}>
            {images.length === 0 ? 'No images yet. Generate your first one!' : 'No images for this filter.'}
          </div>
        ) : (
          <div className="gl">
            {filtered.map((img, i) => (
              <div key={img.id} className="gi" onClick={() => setLbIdx(i)}>
                <img src={img.url} alt="" loading="lazy" />
                <div className="gi-ov">
                  <button className="b bs" style={{ fontSize: '.65rem', padding: '.15rem .3rem' }}
                    onClick={e => { e.stopPropagation(); download(img) }}>&#x2B07;</button>
                  <button className="b bs" style={{ fontSize: '.65rem', padding: '.15rem .3rem', color: 'var(--dng)' }}
                    onClick={e => { e.stopPropagation(); onDelete(img.id) }}>&#x2715;</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Clear all */}
        {images.length > 0 && (
          <div style={{ marginTop: '.8rem' }}>
            {cfmClear ? (
              <div className="cf">
                <span style={{ fontSize: '.82rem', flex: 1 }}>Clear all images?</span>
                <button className="b bs" style={{ background: 'var(--dng)', borderColor: 'var(--dng)', color: '#fff' }}
                  onClick={() => { onClearAll(); setCfmClear(false) }}>Yes</button>
                <button className="b bs" onClick={() => setCfmClear(false)}>No</button>
              </div>
            ) : (
              <button className="b bs" style={{ width: '100%', color: 'var(--dng)' }}
                onClick={() => setCfmClear(true)}>Clear All</button>
            )}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lbIdx !== null && (
        <Lightbox
          images={filtered}
          index={lbIdx}
          onClose={() => setLbIdx(null)}
          onNavigate={setLbIdx}
          onDelete={(id) => { onDelete(id); setLbIdx(null) }}
        />
      )}
    </>
  )
}
