import { useState } from 'react'
import type { Chapter } from '../types'

interface Props {
  show: boolean
  target?: Chapter
  subsequentCount: number
  onClose: () => void
  onConfirm: (mode: 'archive' | 'delete') => void
}

export default function RewindModal({ show, target, subsequentCount, onClose, onConfirm }: Props) {
  const [mode, setMode] = useState<'archive' | 'delete'>('archive')
  if (!show || !target) return null

  return (
    <>
      <div className="mov" onClick={onClose} />
      <div className="mdl">
        <div className="mdl-h">Rewind to this chapter?</div>
        <p style={{ lineHeight: 1.45 }}>
          <strong>{target.title || 'Untitled'}</strong> will become the active chapter.
          The {subsequentCount} chapter{subsequentCount === 1 ? '' : 's'} after it will be
          {mode === 'archive' ? ' archived (recoverable).' : ' permanently deleted.'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
          <label style={{ display: 'flex', gap: '.4rem', alignItems: 'center', fontSize: '.88rem' }}>
            <input type="radio" name="rewind-mode" checked={mode === 'archive'} onChange={() => setMode('archive')} />
            Archive (recoverable from the archived list)
          </label>
          <label style={{ display: 'flex', gap: '.4rem', alignItems: 'center', fontSize: '.88rem' }}>
            <input type="radio" name="rewind-mode" checked={mode === 'delete'} onChange={() => setMode('delete')} />
            Delete permanently
          </label>
        </div>
        <div className="mdl-f">
          <button className="b bs" onClick={onClose}>Cancel</button>
          <button
            className="b ba"
            onClick={() => { onConfirm(mode); onClose() }}
            style={mode === 'delete' ? { background: 'var(--dng)', borderColor: 'var(--dng)', color: '#fff' } : undefined}
          >
            {mode === 'delete' ? 'Delete & rewind' : 'Archive & rewind'}
          </button>
        </div>
      </div>
    </>
  )
}
