import { useState } from 'react'
import { X, Download } from 'lucide-react'
import type { GalleryImage } from '../../types'
import Lightbox from '../Lightbox'
import PanelTabs from '../PanelTabs'
import type { PanelId } from '../PanelTabs'

interface Props {
  show: boolean
  onClose: () => void
  images: GalleryImage[]
  currentSessionId: string
  onNewImage: () => void
  onDelete: (id: string) => void
  onClearAll: () => void
  onSwitch?: (panel: PanelId) => void
  pinnedBgId?: string | null
  onSetBg?: (id: string | null) => void
}

type SourceFilter = 'all' | 'story' | 'lore'
type ScopeFilter = 'current' | 'all' | 'unassigned'

export default function GalleryPanel({ show, onClose, images, currentSessionId, onNewImage, onDelete, onClearAll, onSwitch, pinnedBgId, onSetBg }: Props) {
  const [source, setSource] = useState<SourceFilter>('all')
  const [scope, setScope] = useState<ScopeFilter>('current')
  const [lbIdx, setLbIdx] = useState<number | null>(null)
  const [cfmClear, setCfmClear] = useState(false)

  const hasUnassigned = images.some(i => i.sessionId === null || i.sessionId === undefined)

  // Scope filter: current session, all, or legacy/unassigned images.
  const scoped = scope === 'all'
    ? images
    : scope === 'unassigned'
      ? images.filter(i => i.sessionId === null || i.sessionId === undefined)
      : images.filter(i => i.sessionId === currentSessionId)

  const filtered = source === 'all' ? scoped : scoped.filter(i => i.source === source)

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
          <button className="b bs" onClick={onClose} aria-label="Close gallery"><X size={16} className="ic" /></button>
        </div>
        {onSwitch && <PanelTabs active="gallery" onSwitch={onSwitch} />}

        <button className="b ba" style={{ width: '100%', marginBottom: '.6rem' }} onClick={onNewImage}>
          + New Image
        </button>

        {/* Scope filter */}
        <div style={{ display: 'flex', gap: '.3rem', marginBottom: '.4rem' }}>
          <button className={`b bs${scope === 'current' ? ' ba' : ''}`} onClick={() => setScope('current')}>This session</button>
          <button className={`b bs${scope === 'all' ? ' ba' : ''}`} onClick={() => setScope('all')}>All</button>
          {hasUnassigned && (
            <button className={`b bs${scope === 'unassigned' ? ' ba' : ''}`} onClick={() => setScope('unassigned')}>Unassigned</button>
          )}
        </div>

        {/* Source filter */}
        <div style={{ display: 'flex', gap: '.3rem', marginBottom: '.6rem' }}>
          {(['all', 'story', 'lore'] as SourceFilter[]).map(f => (
            <button
              key={f}
              className={`b bs${source === f ? ' ba' : ''}`}
              onClick={() => setSource(f)}
            >{f.charAt(0).toUpperCase() + f.slice(1)}</button>
          ))}
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--mt)', fontSize: '.85rem' }}>
            {images.length === 0
              ? 'No images yet. Generate your first one!'
              : scope === 'current'
                ? 'No images for this session yet.'
                : 'No images for this filter.'}
          </div>
        ) : (
          <div className="gl">
            {filtered.map((img, i) => (
              <div key={img.id} className="gi" onClick={() => setLbIdx(i)}>
                <img src={img.url} alt="" loading="lazy" />
                <div className="gi-ov">
                  <button className="b bs" style={{ fontSize: '.65rem', padding: '.15rem .3rem' }}
                    onClick={e => { e.stopPropagation(); download(img) }} aria-label="Download image"><Download size={12} className="ic" /></button>
                  <button className="b bs" style={{ fontSize: '.65rem', padding: '.15rem .3rem' }}
                    onClick={e => { e.stopPropagation(); onDelete(img.id) }} aria-label="Delete image"><X size={12} className="ic ic-danger" /></button>
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
          pinnedBgId={pinnedBgId}
          onSetBg={onSetBg}
        />
      )}
    </>
  )
}
