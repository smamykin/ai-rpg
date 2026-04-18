import type { GameState } from '../../types'
import { STYLES } from '../../types'
import { THEMES, FONTS, FONT_SIZE_MIN, FONT_SIZE_MAX, FONT_SIZE_STEP } from '../../display'
import type { DisplayPrefs } from '../../display'
import PanelTabs from '../PanelTabs'
import type { PanelId } from '../PanelTabs'

interface Props {
  show: boolean
  onClose: () => void
  style: string
  cStyle: string
  overview: string
  diff: string
  setField: <K extends keyof GameState>(field: K, value: GameState[K]) => void
  onSwitch?: (panel: PanelId) => void
  displayPrefs: DisplayPrefs
  onSetTheme: (id: string) => void
  onSetFontFamily: (name: string) => void
  onSetFontSize: (size: number) => void
}

export default function SettingsPanel({
  show, onClose, style, cStyle, overview, diff, setField, onSwitch,
  displayPrefs, onSetTheme, onSetFontFamily, onSetFontSize,
}: Props) {
  return (
    <>
      <div className={`ov ${show ? 'o' : ''}`} onClick={onClose} />
      <div className={`pn ${show ? 'o' : ''}`}>
        <div className="ph">
          <span>Settings</span>
          <button className="b bs" onClick={onClose}>&#x2715;</button>
        </div>
        {onSwitch && <PanelTabs active="settings" onSwitch={onSwitch} />}

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

        <div style={{ borderTop: '1px solid var(--bd)', margin: '.6rem 0', paddingTop: '.6rem' }}>
          <label className="lb" style={{ marginBottom: '.5rem' }}>Display</label>
        </div>

        <div className="gr">
          <label className="lb">Theme</label>
          <div className="ts">
            {THEMES.map(t => (
              <button
                key={t.id}
                className={`tw${displayPrefs.theme === t.id ? ' ta' : ''}`}
                onClick={() => onSetTheme(t.id)}
                title={t.name}
                style={{ background: t.vars['--bg'] }}
              >
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%',
                  background: `linear-gradient(135deg, ${t.vars['--ac']} 50%, ${t.vars['--ac2']} 50%)`,
                }} />
              </button>
            ))}
          </div>
        </div>

        <div className="gr">
          <label className="lb">Story Font</label>
          <select value={displayPrefs.fontFamily} onChange={e => onSetFontFamily(e.target.value)}>
            {FONTS.map(f => (
              <option key={f.name} value={f.name}>{f.name} ({f.category})</option>
            ))}
          </select>
        </div>

        <div className="gr">
          <label className="lb">Font Size</label>
          <div className="fss">
            <button
              className="b bs"
              onClick={() => onSetFontSize(displayPrefs.fontSize - FONT_SIZE_STEP)}
              disabled={displayPrefs.fontSize <= FONT_SIZE_MIN}
            >&minus;</button>
            <input
              type="number"
              value={displayPrefs.fontSize}
              min={FONT_SIZE_MIN}
              max={FONT_SIZE_MAX}
              step={FONT_SIZE_STEP}
              onChange={e => onSetFontSize(parseFloat(e.target.value) || FONT_SIZE_MIN)}
            />
            <button
              className="b bs"
              onClick={() => onSetFontSize(displayPrefs.fontSize + FONT_SIZE_STEP)}
              disabled={displayPrefs.fontSize >= FONT_SIZE_MAX}
            >+</button>
          </div>
        </div>
      </div>
    </>
  )
}
