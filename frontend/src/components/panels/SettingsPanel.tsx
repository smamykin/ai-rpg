import { useState, useCallback, useEffect } from 'react'
import { X, Square, RefreshCw, Hourglass, Download, Save } from 'lucide-react'
import type { ModelInfo, ModelRole, TTSSettings } from '../../types'
import { MODEL_ROLES } from '../../types'
import { THEMES, FONTS, FONT_SIZE_MIN, FONT_SIZE_MAX, FONT_SIZE_STEP, AMBIENT_BLUR_MIN, AMBIENT_BLUR_MAX } from '../../display'
import type { DisplayPrefs } from '../../display'
import PanelTabs from '../PanelTabs'
import type { PanelId } from '../PanelTabs'
import ModelPicker from '../ModelPicker'
import ModalTextField from '../ModalTextField'
import { TTS_MODELS, TTS_VOICES, getModelMeta, getModelSettings } from '../../constants/tts'
import { useInstallPrompt } from '../../hooks/useInstallPrompt'
import * as apiClient from '../../api'

const ROLE_LABELS: Record<ModelRole, { name: string; hint: string }> = {
  summary:        { name: 'Summaries',      hint: 'Compressing old story into memory. Cheap + long-context works well.' },
  imagePrompt:    { name: 'Image prompts',  hint: 'Turning instructions into vivid image prompts.' },
  loreGen:        { name: 'Lore',           hint: 'Generating lore entries from story context.' },
  scenarioPolish: { name: 'Scenario polish', hint: 'Refining scenario overviews and lore during authoring.' },
  naming:         { name: 'Naming',         hint: 'Tiny calls: suggested names for sessions, lore entries, scenarios.' },
}

interface Props {
  show: boolean
  onClose: () => void
  onSwitch?: (panel: PanelId) => void
  visibleTabs?: PanelId[]
  scope?: 'session' | 'global'
  storyModel: string
  supportModel: string
  reasoningEffort?: string
  modelRoles?: Record<string, string>
  effectiveCtxTokens: number
  // Wide signature so both useGameState's and useGlobalSettings's setField
  // can be passed without TS choking on higher-rank generic narrowing.
  setField: (field: any, value: any) => void
  displayPrefs: DisplayPrefs
  onSetTheme: (id: string) => void
  onSetFontFamily: (name: string) => void
  onSetFontSize: (size: number) => void
  onSetEditorFontFamily: (name: string) => void
  onSetEditorFontSize: (size: number) => void
  onSetAmbientBg: (on: boolean) => void
  onSetAmbientBlur: (px: number) => void
  tts: TTSSettings
  dispatch: React.Dispatch<any>
  ttsPlaying: boolean
  onStopTTS: () => void
  onSaveAsDefaults?: () => void
}

export default function SettingsPanel({
  show, onClose, onSwitch, visibleTabs, scope = 'session',
  storyModel, supportModel, reasoningEffort, modelRoles,
  effectiveCtxTokens, setField,
  displayPrefs, onSetTheme, onSetFontFamily, onSetFontSize, onSetEditorFontFamily, onSetEditorFontSize, onSetAmbientBg, onSetAmbientBlur,
  tts, dispatch, ttsPlaying, onStopTTS, onSaveAsDefaults,
}: Props) {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsErr, setModelsErr] = useState('')
  const [ctxDraft, setCtxDraft] = useState<string | null>(null)
  const install = useInstallPrompt()

  const loadModels = useCallback(async () => {
    setModelsLoading(true)
    setModelsErr('')
    try {
      const list = await apiClient.getModels()
      setModels(list)
    } catch (e) {
      setModelsErr(e instanceof Error ? e.message : 'Failed to load models')
    }
    setModelsLoading(false)
  }, [])

  useEffect(() => {
    if (show && models.length === 0 && !modelsLoading) {
      loadModels()
    }
  }, [show, models.length, modelsLoading, loadModels])

  const modelCtx = models.find(m => m.id === storyModel)?.ctx || 0
  const ctxMax = Math.max(modelCtx || 128000, 8000)

  const activeTTSModel = tts?.activeModel || 'Kokoro-82m'
  const ttsMeta = getModelMeta(activeTTSModel)
  const ttsModelSettings = getModelSettings(tts, activeTTSModel)
  const voices = TTS_VOICES[activeTTSModel] || []

  const updateTTSSetting = (key: 'voice' | 'speed' | 'instructions' | 'dialogueVoice', value: string | number) => {
    dispatch({ type: 'SET_TTS_MODEL_SETTING', model: activeTTSModel, settings: { [key]: value } })
  }

  return (
    <>
      <div className={`ov ${show ? 'o' : ''}`} onClick={onClose} />
      <div className={`pn ${show ? 'o' : ''}`}>
        <div className="ph">
          <span>{scope === 'global' ? 'Defaults for new adventures' : 'Settings'}</span>
          <button className="b bs" onClick={onClose} aria-label="Close settings"><X size={16} className="ic ic-muted" /></button>
        </div>
        {onSwitch && <PanelTabs active="settings" onSwitch={onSwitch} visibleTabs={visibleTabs} />}

        {install.canInstall && (
          <div className="gr">
            <button className="b" onClick={install.install}>
              <Download size={14} className="ic" /> Install app
            </button>
            <div className="hint">Adds AI RPG to your home screen and launches in standalone mode.</div>
          </div>
        )}

        <div style={{ margin: '0 0 .6rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.5rem' }}>
          <label className="lb" style={{ marginBottom: 0 }}>AI Model</label>
          {scope === 'session' && onSaveAsDefaults && (
            <button
              className="b bs"
              onClick={onSaveAsDefaults}
              title="Save current AI Model and TTS settings as defaults for new adventures"
            >
              <Save size={12} className="ic" /> Save as defaults
            </button>
          )}
        </div>

        <div className="gr">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.3rem' }}>
            <label className="lb" style={{ marginBottom: 0 }}>Models</label>
            <button className="b bs" onClick={loadModels} disabled={modelsLoading}>
              {modelsLoading ? <Hourglass size={12} className="ic" /> : <RefreshCw size={12} className="ic" />} {models.length ? `Refresh (${models.length})` : 'Load'}
            </button>
          </div>
          {modelsErr && <div className="er" style={{ margin: '.3rem 0' }}>{modelsErr}</div>}
          {!models.length && !modelsLoading && !modelsErr && (
            <div className="hint">Click Load to fetch the model list.</div>
          )}
        </div>

        <div className="gr">
          <label className="lb">Story model</label>
          <ModelPicker
            id="story"
            value={storyModel}
            onChange={v => setField('storyModel', v)}
            models={models}
            placeholder="e.g. anthropic/claude-sonnet-4-20250514"
          />
          <div className="hint">Used for narrative generation. Pick a strong writing model.</div>
        </div>

        <div className="gr">
          <label className="lb">Support model</label>
          <div style={{ display: 'flex', gap: '.35rem', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <ModelPicker
                id="support"
                value={supportModel}
                onChange={v => setField('supportModel', v)}
                models={models}
                placeholder="e.g. openai/gpt-4.1-mini"
              />
            </div>
            {storyModel && storyModel !== supportModel && (
              <button className="b bs" onClick={() => setField('supportModel', storyModel)} title="Use same as story model">=</button>
            )}
          </div>
          <div className="hint">Default fallback for all non-story tasks. Individual tasks below can override.</div>
        </div>

        <details className="adv">
          <summary>Advanced &mdash; per-task models</summary>
          <div className="hint" style={{ marginBottom: '.5rem' }}>
            Override specific tasks. Empty = inherit Support.
          </div>
          {MODEL_ROLES.map(role => {
            const current = modelRoles?.[role] ?? ''
            return (
              <div key={role} className="gr">
                <label className="lb">{ROLE_LABELS[role].name}</label>
                <ModelPicker
                  id={`role-${role}`}
                  value={current}
                  onChange={v => {
                    const next = { ...(modelRoles || {}) }
                    if (v) next[role] = v
                    else delete next[role]
                    setField('modelRoles', next)
                  }}
                  models={models}
                  placeholder="(inherit Support)"
                />
                <div className="hint">{ROLE_LABELS[role].hint}</div>
              </div>
            )
          })}
        </details>

        <div className="gr">
          <label className="lb">Reasoning effort</label>
          <select
            value={reasoningEffort || 'none'}
            onChange={e => setField('reasoningEffort', e.target.value)}
          >
            <option value="none">Off</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="xhigh">Extra high</option>
          </select>
          <div className="hint">For thinking models (gpt-5, o1, deepseek-r1, claude :thinking variants). Reasoning tokens count as output tokens.</div>
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
          <div className="fss" style={{ marginTop: '.35rem' }}>
            <input
              type="number"
              min={8000}
              max={ctxMax}
              step={1000}
              value={ctxDraft !== null ? ctxDraft : Math.min(effectiveCtxTokens, ctxMax)}
              onChange={e => setCtxDraft(e.target.value)}
              onBlur={() => {
                if (ctxDraft === null) return
                const n = Number(ctxDraft)
                if (Number.isFinite(n) && ctxDraft.trim() !== '') {
                  setField('effectiveCtxTokens', Math.min(ctxMax, Math.max(8000, n)))
                }
                setCtxDraft(null)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                else if (e.key === 'Escape') { setCtxDraft(null); (e.target as HTMLInputElement).blur() }
              }}
              style={{ width: '90px' }}
            />
            <span className="hint" style={{ margin: 0 }}>tokens</span>
          </div>
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
            <button className="b bs" onClick={onStopTTS} style={{ marginTop: '.4rem' }}><Square size={14} className="ic ic-danger" fill="currentColor" /> Stop playback</button>
          )}
        </div>

        <div className="gr">
          <label className="lb">TTS Model</label>
          <select value={activeTTSModel} onChange={e => dispatch({ type: 'SET_TTS_MODEL', model: e.target.value })}>
            {TTS_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <div className="hint">${ttsMeta.pricePer1K.toFixed(4)} per 1K chars.</div>
        </div>

        <div className="gr">
          <label className="lb">Voice</label>
          <select value={ttsModelSettings.voice} onChange={e => updateTTSSetting('voice', e.target.value)}>
            {voices.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </div>

        <div className="gr">
          <label className="lb">Speed: {(ttsModelSettings.speed || 1.0).toFixed(2)}x</label>
          <input
            type="range"
            min={0.5}
            max={2.0}
            step={0.05}
            value={ttsModelSettings.speed || 1.0}
            onChange={e => updateTTSSetting('speed', parseFloat(e.target.value))}
          />
        </div>

        {ttsMeta.supportsInstructions && (
          <div className="gr">
            <label className="lb">Instructions</label>
            <ModalTextField
              value={ttsModelSettings.instructions || ''}
              onChange={v => updateTTSSetting('instructions', v)}
              placeholder='e.g. "read in a dramatic whisper, like an ancient storyteller"'
              lines={2}
              title="TTS instructions"
            />
            <div className="hint">Natural-language voice direction.</div>
          </div>
        )}

        {ttsMeta.supportsDialogueVoice && (
          <div className="gr">
            <label className="lb">Dialogue voice (optional)</label>
            <select value={ttsModelSettings.dialogueVoice || ''} onChange={e => updateTTSSetting('dialogueVoice', e.target.value)}>
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
          <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={displayPrefs.ambientBg}
              onChange={e => onSetAmbientBg(e.target.checked)}
              style={{ width: '18px', height: '18px' }}
            />
            <span>Ambient image background</span>
          </label>
          <div className="hint">Blurred pinned/latest image behind the story.</div>
        </div>

        {displayPrefs.ambientBg && (
          <div className="gr">
            <label className="lb">Blur Strength</label>
            <div className="gm-sl">
              <input
                type="range"
                min={AMBIENT_BLUR_MIN}
                max={AMBIENT_BLUR_MAX}
                step={1}
                value={displayPrefs.ambientBlur}
                onChange={e => onSetAmbientBlur(parseInt(e.target.value, 10))}
              />
              <span className="gm-sv">{displayPrefs.ambientBlur}px</span>
            </div>
          </div>
        )}

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

        <div className="gr">
          <label className="lb">Editor Font</label>
          <select value={displayPrefs.editorFontFamily} onChange={e => onSetEditorFontFamily(e.target.value)}>
            {FONTS.map(f => (
              <option key={f.name} value={f.name}>{f.name} ({f.category})</option>
            ))}
          </select>
          <div className="hint">Used by the pop-up text editor.</div>
        </div>

        <div className="gr">
          <label className="lb">Editor Font Size</label>
          <div className="fss">
            <button
              className="b bs"
              onClick={() => onSetEditorFontSize(displayPrefs.editorFontSize - FONT_SIZE_STEP)}
              disabled={displayPrefs.editorFontSize <= FONT_SIZE_MIN}
            >&minus;</button>
            <input
              type="number"
              value={displayPrefs.editorFontSize}
              min={FONT_SIZE_MIN}
              max={FONT_SIZE_MAX}
              step={FONT_SIZE_STEP}
              onChange={e => onSetEditorFontSize(parseFloat(e.target.value) || FONT_SIZE_MIN)}
            />
            <button
              className="b bs"
              onClick={() => onSetEditorFontSize(displayPrefs.editorFontSize + FONT_SIZE_STEP)}
              disabled={displayPrefs.editorFontSize >= FONT_SIZE_MAX}
            >+</button>
          </div>
        </div>
      </div>
    </>
  )
}
