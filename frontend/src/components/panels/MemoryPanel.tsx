import { useState } from 'react'
import type { Memory, GameState } from '../../types'
import { uid } from '../../types'

interface Props {
  show: boolean
  onClose: () => void
  mems: Memory[]
  addlMem: string
  wordCount: number
  canSummarize: boolean
  summarizeWordCount: number
  summing: boolean
  dispatch: React.Dispatch<any>
  setField: <K extends keyof GameState>(field: K, value: GameState[K]) => void
  onSummarize: () => void
}

export default function MemoryPanel({
  show, onClose, mems, addlMem, wordCount: wc,
  canSummarize, summarizeWordCount, summing,
  dispatch, setField, onSummarize,
}: Props) {
  const [newMem, setNewMem] = useState('')

  return (
    <>
      <div className={`ov ${show ? 'o' : ''}`} onClick={onClose} />
      <div className={`pn ${show ? 'o' : ''}`}>
        <div className="ph">
          <span>Memory</span>
          <button className="b bs" onClick={onClose}>&#x2715;</button>
        </div>

        <label className="lb">Summary entries ({mems.length})</label>
        {mems.length === 0 && <p style={{ color: 'var(--mt)', fontSize: '.82rem', marginBottom: '.5rem' }}>No entries yet.</p>}
        {mems.map((e, i) => (
          <div key={e.id} className="me">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.25rem' }}>
              <span style={{ fontSize: '.7rem', color: 'var(--mt)' }}>Entry {i + 1}</span>
              <button className="b bs" onClick={() => dispatch({ type: 'REMOVE_MEM', id: e.id })} style={{ padding: '.15rem .35rem', fontSize: '.68rem' }}>&#x2715;</button>
            </div>
            <textarea
              className="mt"
              value={e.text}
              onChange={ev => dispatch({ type: 'UPDATE_MEM', id: e.id, text: ev.target.value })}
              rows={3}
            />
          </div>
        ))}

        <div style={{ marginBottom: '.75rem' }}>
          <textarea className="mt" value={newMem} onChange={e => setNewMem(e.target.value)} placeholder="Add manual entry..." rows={2} style={{ marginBottom: '.3rem' }} />
          <button className="b bs" onClick={() => {
            if (newMem.trim()) {
              dispatch({ type: 'ADD_MEM', mem: { id: uid(), text: newMem.trim() } })
              setNewMem('')
            }
          }} disabled={!newMem.trim()}>+ Add</button>
        </div>

        <div style={{ borderTop: '1px solid var(--bd)', paddingTop: '.6rem', marginBottom: '.75rem' }}>
          <label className="lb">Summarize</label>
          <div style={{ fontSize: '.82rem', color: 'var(--mt)' }}>{wc.toLocaleString()} words</div>
          {canSummarize ? (
            <button className="b bs" onClick={onSummarize} disabled={summing} style={{ marginTop: '.4rem' }}>
              {summing ? '\u23f3...' : `Summarize ${summarizeWordCount.toLocaleString()}w`}
            </button>
          ) : (
            <p style={{ fontSize: '.75rem', color: 'var(--mt)', marginTop: '.3rem' }}>Needs more text.</p>
          )}
        </div>

        <div>
          <label className="lb">Additional Memory</label>
          <textarea value={addlMem} onChange={e => setField('addlMem', e.target.value)} placeholder="Persistent notes..." rows={4} style={{ fontSize: '.85rem' }} />
          <div style={{ fontSize: '.7rem', color: 'var(--mt)', marginTop: '.25rem' }}>Always included in every prompt.</div>
        </div>
      </div>
    </>
  )
}
