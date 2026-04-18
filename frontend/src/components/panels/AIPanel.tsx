import { useState, useCallback, useEffect } from 'react'
import ModelPicker from '../ModelPicker'
import type { ModelInfo, GameState } from '../../types'
import * as apiClient from '../../api'

interface Props {
  show: boolean
  onClose: () => void
  storyModel: string
  supportModel: string
  setField: <K extends keyof GameState>(field: K, value: GameState[K]) => void
}

export default function AIPanel({ show, onClose, storyModel, supportModel, setField }: Props) {
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
          <div className="hint">Used for summaries and stat tracking. If empty, uses the story model.</div>
        </div>
      </div>
    </>
  )
}
