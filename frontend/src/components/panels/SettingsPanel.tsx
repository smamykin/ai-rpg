import type { GameState, TTSSettings } from '../../types'
import { STYLES } from '../../types'
import { THEMES, FONTS, FONT_SIZE_MIN, FONT_SIZE_MAX, FONT_SIZE_STEP } from '../../display'
import type { DisplayPrefs } from '../../display'
import PanelTabs from '../PanelTabs'
import type { PanelId } from '../PanelTabs'
import { TTS_MODELS, TTS_VOICES, getModelMeta, getModelSettings } from '../../constants/tts'
import * as api from '../../api'

interface Props {
  show: boolean
  onClose: () => void
  style: string
  cStyle: string
  overview: string
  diff: string
  effectiveCtxTokens: number
  modelCtxMax?: number
  setField: <K extends keyof GameState>(field: K, value: GameState[K]) => void
  onSwitch?: (panel: PanelId) => void
  displayPrefs: DisplayPrefs
  onSetTheme: (id: string) => void
  onSetFontFamily: (name: string) => void
  onSetFontSize: (size: number) => void
  tts: TTSSettings
  dispatch: React.Dispatch<any>
  ttsPlaying: boolean
  onStopTTS: () => void
}

export default function SettingsPanel({
  show, onClose, style, cStyle, overview, diff, effectiveCtxTokens, modelCtxMax, setField, onSwitch,
  displayPrefs, onSetTheme, onSetFontFamily, onSetFontSize,
  tts, dispatch, ttsPlaying, onStopTTS,
}: Props) {
  const ctxMax = Math.max(modelCtxMax || 128000, 8000)
  const activeModel = tts?.activeModel || 'Kokoro-82m'
  const modelMeta = getModelMeta(activeModel)
  const modelSettings = getModelSettings(tts, activeModel)
  const voices = TTS_VOICES[activeModel] || []

  const updateModelSetting = (key: 'voice' | 'speed' | 'instructions' | 'dialogueVoice', value: string | number) => {
    dispatch({ type: 'SET_TTS_MODEL_SETTING', model: activeModel, settings: { [key]: value } })
  }

  const handleClearAllData = async () => {
    if (!window.confirm('Delete all sessions, scenarios, gallery images, and local preferences? This cannot be undone.')) return
    if (!window.confirm('Really? Everything will be wiped and the app will reload.')) return
    try {
      await api.resetAllData()
    } catch { /* ignore — we're wiping anyway */ }
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k && k.startsWith('ai-rpg-')) localStorage.removeItem(k)
    }
    location.reload()
  }

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

        <div className="gr">
          <label className="lb">Effective context ({(effectiveCtxTokens / 1000).toFixed(0)}k / {(ctxMax / 1000).toFixed(0)}k supported)</label>
          <input
            type="range"
            min={8000}
            max={ctxMax}
            step={1000}
            value={Math.min(effectiveCtxTokens, ctxMax)}
            onChange={e => setField('effectiveCtxTokens', Number(e.target.value))}
          />
          <div className="hint">Token budget for each prompt. The app warns at 65% and blocks generation at 90%.</div>
        </div>

        <div style={{ borderTop: '1px solid var(--bd)', margin: '.6rem 0', paddingTop: '.6rem' }}>
          <label className="lb" style={{ marginBottom: '.5rem' }}>Text-to-Speech</label>
        </div>

        <div className="gr">
          <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!!tts?.autoPlay}
              onChange={e => dispatch({ type: 'SET_TTS_AUTOPLAY', autoPlay: e.target.checked })}
            />
            <span>Auto-play new narration</span>
          </label>
          {ttsPlaying && (
            <button className="b bs" onClick={onStopTTS} style={{ color: 'var(--dng)', marginTop: '.4rem' }}>&#x23f9; Stop playback</button>
          )}
        </div>

        <div className="gr">
          <label className="lb">TTS Model</label>
          <select value={activeModel} onChange={e => dispatch({ type: 'SET_TTS_MODEL', model: e.target.value })}>
            {TTS_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <div className="hint">${modelMeta.pricePer1K.toFixed(4)} per 1K chars.</div>
        </div>

        <div className="gr">
          <label className="lb">Voice</label>
          <select value={modelSettings.voice} onChange={e => updateModelSetting('voice', e.target.value)}>
            {voices.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </div>

        <div className="gr">
          <label className="lb">Speed: {(modelSettings.speed || 1.0).toFixed(2)}x</label>
          <input
            type="range"
            min={0.5}
            max={2.0}
            step={0.05}
            value={modelSettings.speed || 1.0}
            onChange={e => updateModelSetting('speed', parseFloat(e.target.value))}
          />
        </div>

        {modelMeta.supportsInstructions && (
          <div className="gr">
            <label className="lb">Instructions</label>
            <textarea
              value={modelSettings.instructions || ''}
              onChange={e => updateModelSetting('instructions', e.target.value)}
              placeholder='e.g. "read in a dramatic whisper, like an ancient storyteller"'
              rows={2}
            />
            <div className="hint">Natural-language voice direction.</div>
          </div>
        )}

        {modelMeta.supportsDialogueVoice && (
          <div className="gr">
            <label className="lb">Dialogue voice (optional)</label>
            <select value={modelSettings.dialogueVoice || ''} onChange={e => updateModelSetting('dialogueVoice', e.target.value)}>
              <option value="">&mdash; none &mdash;</option>
              {voices.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
            <div className="hint">If set, text in quotes uses this voice.</div>
          </div>
        )}

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

        <div style={{ borderTop: '1px solid var(--bd)', margin: '.6rem 0', paddingTop: '.6rem' }}>
          <label className="lb" style={{ marginBottom: '.5rem', color: 'var(--dng)' }}>Danger Zone</label>
        </div>

        <div className="gr">
          <button
            className="b"
            onClick={handleClearAllData}
            style={{ color: 'var(--dng)', borderColor: 'var(--dng)' }}
          >
            Clear all data
          </button>
          <div className="hint">Deletes all sessions, scenarios, gallery images, and local preferences (including TTS settings). Cannot be undone.</div>
        </div>
      </div>
    </>
  )
}
