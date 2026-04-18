import type { GameState } from '../../types'
import { STYLES } from '../../types'

interface Props {
  show: boolean
  onClose: () => void
  style: string
  cStyle: string
  overview: string
  diff: string
  setField: <K extends keyof GameState>(field: K, value: GameState[K]) => void
}

export default function SettingsPanel({ show, onClose, style, cStyle, overview, diff, setField }: Props) {
  return (
    <>
      <div className={`ov ${show ? 'o' : ''}`} onClick={onClose} />
      <div className={`pn ${show ? 'o' : ''}`}>
        <div className="ph">
          <span>Settings</span>
          <button className="b bs" onClick={onClose}>&#x2715;</button>
        </div>

        <div className="gr">
          <label className="lb">Response Length</label>
          <select value={style} onChange={e => setField('style', e.target.value)}>
            {STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <div className="gr">
          <label className="lb">Custom Writing Style</label>
          <textarea value={cStyle} onChange={e => setField('cStyle', e.target.value)} placeholder='e.g. "Lovecraftian horror"' rows={3} />
          <div className="hint">Overrides default style when set.</div>
        </div>

        <div className="gr">
          <label className="lb">Adventure Overview</label>
          <textarea value={overview} onChange={e => setField('overview', e.target.value)} placeholder="What it's about..." rows={3} />
        </div>

        <div className="gr">
          <label className="lb">Difficulty</label>
          <select value={diff} onChange={e => setField('diff', e.target.value)}>
            <option value="normal">Normal</option>
            <option value="hard">Hard (permadeath)</option>
          </select>
        </div>
      </div>
    </>
  )
}
