import type { GameState } from '../types'
import { STYLES } from '../types'
import GlobalMenu from './GlobalMenu'
import SuggestNameButton from './SuggestNameButton'
import ExpandableTextarea from './ExpandableTextarea'

interface Props {
  state: GameState
  setField: <K extends keyof GameState>(field: K, value: GameState[K]) => void
  onStart: () => void
  onBack: () => void
}

export default function Setup({ state, setField, onStart, onBack }: Props) {
  return (
    <div className="R">
      <div className="hd">
        <button className="b bs" onClick={onBack} title="Back to sessions" aria-label="Back to sessions">&larr;</button>
        <h1>New Adventure</h1>
        <GlobalMenu />
      </div>

      <div className="su">
        <div>
          <p className="ss" style={{ marginTop: '.5rem' }}>Set the scene, then begin.</p>
        </div>

        <div style={{ width: '100%' }}>
          <label className="lb">Adventure name</label>
          <div style={{ display: 'flex', gap: '.3rem', alignItems: 'center' }}>
            <input
              type="text"
              value={state.name}
              onChange={e => setField('name', e.target.value)}
              placeholder="Adventure"
              style={{ flex: 1 }}
            />
            <SuggestNameButton
              kind="session"
              text={state.overview}
              context={{ overview: state.overview }}
              disabled={!state.overview.trim()}
              onSuggest={n => setField('name', n)}
            />
          </div>
        </div>

        <div style={{ width: '100%' }}>
          <label className="lb">Adventure overview</label>
          <ExpandableTextarea
            value={state.overview}
            onChange={v => setField('overview', v)}
            placeholder='e.g. "A rogue thief in a steampunk city"'
            rows={4}
            style={{ lineHeight: 1.5 }}
            title="Adventure overview"
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
      </div>
    </div>
  )
}
