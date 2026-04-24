import { useState } from 'react'
import { X, Hourglass } from 'lucide-react'
import type { Section, GameState } from '../../types'
import { uid } from '../../types'
import PanelTabs from '../PanelTabs'
import type { PanelId } from '../PanelTabs'

interface Props {
  show: boolean
  onClose: () => void
  secs: Section[]
  auFreq: number
  stUp: boolean
  dispatch: React.Dispatch<any>
  setField: <K extends keyof GameState>(field: K, value: GameState[K]) => void
  onUpdateStats: () => void
  onSwitch?: (panel: PanelId) => void
}

export default function TrackingPanel({
  show, onClose, secs, auFreq, stUp,
  dispatch, setField, onUpdateStats, onSwitch,
}: Props) {
  const [nName, setNName] = useState('')
  const [nDesc, setNDesc] = useState('')

  return (
    <>
      <div className={`ov ${show ? 'o' : ''}`} onClick={onClose} />
      <div className={`pn ${show ? 'o' : ''}`}>
        <div className="ph">
          <span>Tracking</span>
          <button className="b bs" onClick={onClose} aria-label="Close tracking"><X size={16} className="ic ic-muted" /></button>
        </div>
        {onSwitch && <PanelTabs active="track" onSwitch={onSwitch} />}

        {secs.length < 5 && (
          <div className="ax">
            <label className="lb">Add section {secs.length > 0 ? `(${secs.length}/5)` : ''}</label>
            <input type="text" value={nName} onChange={e => setNName(e.target.value)} placeholder="Name" style={{ marginBottom: '.35rem', fontSize: '.85rem', padding: '.4rem .6rem' }} />
            <textarea value={nDesc} onChange={e => setNDesc(e.target.value)} placeholder="What to track" rows={2} style={{ fontSize: '.82rem', padding: '.4rem .6rem', marginBottom: '.35rem' }} />
            <button className="b bs ba" onClick={() => {
              if (nName.trim() && secs.length < 5) {
                dispatch({ type: 'ADD_SEC', sec: { id: uid(), name: nName.trim(), description: nDesc.trim(), content: '' } })
                setNName('')
                setNDesc('')
              }
            }} disabled={!nName.trim()}>+ Add</button>
          </div>
        )}

        {secs.map(s => (
          <div key={s.id} className="sc">
            <div className="sh">
              <span className="sn">{s.name}</span>
              <button className="b bs" onClick={() => dispatch({ type: 'REMOVE_SEC', id: s.id })} style={{ padding: '.15rem .4rem', fontSize: '.68rem' }} aria-label="Remove section"><X size={12} className="ic ic-muted" /></button>
            </div>
            {s.description && <div className="sd">{s.description}</div>}
            <textarea
              className="st2"
              value={s.content}
              onChange={e => dispatch({ type: 'UPDATE_SEC', id: s.id, content: e.target.value })}
              placeholder="Click Update All..."
            />
          </div>
        ))}

        {secs.length > 0 && (
          <div style={{ borderTop: '1px solid var(--bd)', paddingTop: '.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.5rem' }}>
              <label style={{ fontSize: '.82rem', color: 'var(--mt)', whiteSpace: 'nowrap' }}>Auto-update every</label>
              <input type="number" className="ni" min={0} max={10} value={auFreq}
                onChange={e => setField('auFreq', Math.max(0, Math.min(10, parseInt(e.target.value) || 0)))} />
              <span style={{ fontSize: '.82rem', color: 'var(--mt)' }}>gens</span>
            </div>
            <div style={{ fontSize: '.7rem', color: 'var(--mt)', marginBottom: '.5rem' }}>0 = manual only.</div>
            <button className="b ba" onClick={onUpdateStats} disabled={stUp} style={{ width: '100%', justifyContent: 'center' }}>
              {stUp ? <><Hourglass size={12} className="ic" />...</> : 'Update All'}
            </button>
          </div>
        )}

        {secs.length === 0 && (
          <p style={{ color: 'var(--mt)', fontSize: '.85rem', textAlign: 'center', padding: '1rem 0' }}>Add a section to track.</p>
        )}
      </div>
    </>
  )
}
