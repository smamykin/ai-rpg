import { useState } from 'react'
import type { GameState } from '../types'
import { STYLES } from '../types'
import AIPanel from './panels/AIPanel'

interface Props {
  state: {
    overview: string
    cStyle: string
    style: string
    diff: string
    storyModel: string
    supportModel: string
  }
  setField: <K extends keyof GameState>(field: K, value: GameState[K]) => void
  onStart: () => void
  onLoad: () => void
}

export default function Setup({ state, setField, onStart, onLoad }: Props) {
  const [showAI, setShowAI] = useState(false)

  return (
    <div className="R">
      <div className="su">
        <div>
          <div className="st">AI RPG</div>
          <p className="ss" style={{ marginTop: '.5rem' }}>Open-world text adventure</p>
        </div>

        <div style={{ width: '100%' }}>
          <label className="lb">Adventure overview</label>
          <textarea
            value={state.overview}
            onChange={e => setField('overview', e.target.value)}
            placeholder='e.g. "A rogue thief in a steampunk city"'
            rows={4}
            style={{ lineHeight: 1.5 }}
          />
        </div>

        <div style={{ width: '100%' }}>
          <label className="lb">Writing style (optional)</label>
          <input
            type="text"
            value={state.cStyle}
            onChange={e => setField('cStyle', e.target.value)}
            placeholder='e.g. "dark and literary"'
          />
        </div>

        <div className="sr">
          <div>
            <label className="lb">Length</label>
            <select value={state.style} onChange={e => setField('style', e.target.value)}>
              {STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="lb">Difficulty</label>
            <select value={state.diff} onChange={e => setField('diff', e.target.value)}>
              <option value="normal">Normal</option>
              <option value="hard">Hard (permadeath)</option>
            </select>
          </div>
        </div>

        <button
          className="b ba"
          style={{ width: '100%', padding: '.85rem', fontSize: '1.05rem', fontWeight: 600 }}
          onClick={onStart}
        >
          Begin Adventure
        </button>

        <div style={{ display: 'flex', gap: '.5rem' }}>
          <button className="b bs" onClick={onLoad}>Load</button>
          <button className="b bs" onClick={() => setShowAI(true)}>AI Model</button>
        </div>
      </div>

      <AIPanel
        show={showAI}
        onClose={() => setShowAI(false)}
        storyModel={state.storyModel}
        supportModel={state.supportModel}
        setField={setField}
      />
    </div>
  )
}
