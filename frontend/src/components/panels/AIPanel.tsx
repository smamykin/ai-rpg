import { useState, useCallback, useEffect } from 'react'
import ModelPicker from '../ModelPicker'
import PanelTabs from '../PanelTabs'
import type { PanelId } from '../PanelTabs'
import type { ModelInfo, GameState, ModelRole } from '../../types'
import { MODEL_ROLES } from '../../types'
import * as apiClient from '../../api'

interface Props {
  show: boolean
  onClose: () => void
  storyModel: string
  supportModel: string
  modelRoles?: Record<string, string>
  setField: <K extends keyof GameState>(field: K, value: GameState[K]) => void
  onSwitch?: (panel: PanelId) => void
}

const ROLE_LABELS: Record<ModelRole, { name: string; hint: string }> = {
  summary:        { name: 'Summaries',      hint: 'Compressing old story into memory. Cheap + long-context works well.' },
  imagePrompt:    { name: 'Image prompts',  hint: 'Turning instructions into vivid image prompts.' },
  loreGen:        { name: 'Lore',           hint: 'Generating lore entries from story context.' },
  scenarioPolish: { name: 'Scenario polish', hint: 'Refining scenario overviews and lore during authoring.' },
  naming:         { name: 'Naming',         hint: 'Tiny calls: suggested names for sessions, lore entries, scenarios.' },
}

export default function AIPanel({ show, onClose, storyModel, supportModel, modelRoles, setField, onSwitch }: Props) {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsErr, setModelsErr] = useState('')

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

  // Auto-load models on first open
  useEffect(() => {
    if (show && models.length === 0 && !modelsLoading) {
      loadModels()
    }
  }, [show, models.length, modelsLoading, loadModels])

  return (
    <>
      <div className={`ov ${show ? 'o' : ''}`} onClick={onClose} />
      <div className={`pn ${show ? 'o' : ''}`}>
        <div className="ph">
          <span>AI Model</span>
          <button className="b bs" onClick={onClose}>&#x2715;</button>
        </div>
        {onSwitch && <PanelTabs active="ai" onSwitch={onSwitch} />}

        <div className="gr">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.3rem' }}>
            <label className="lb" style={{ marginBottom: 0 }}>Models</label>
            <button className="b bs" onClick={loadModels} disabled={modelsLoading}>
              {modelsLoading ? '\u23f3' : '\ud83d\udd04'} {models.length ? `Refresh (${models.length})` : 'Load'}
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
      </div>
    </>
  )
}
