import { useEffect, useState } from 'react'
import type { Scenario } from '../types'
import { defaultScenario, STYLES } from '../types'
import LoreEditor from './LoreEditor'
import SuggestNameButton from './SuggestNameButton'
import * as api from '../api'

interface Props {
  scenarioId: string | null  // null = creating new
  onSaved: (sc: Scenario) => void
  onCancel: () => void
  onDeleted?: (id: string) => void
}

export default function ScenarioEditor({ scenarioId, onSaved, onCancel, onDeleted }: Props) {
  const [sc, setSc] = useState<Scenario>(() => defaultScenario())
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [cfmDelete, setCfmDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (scenarioId) {
      setLoading(true)
      api.getScenario(scenarioId)
        .then(setSc)
        .catch(e => setErr((e as Error).message))
        .finally(() => setLoading(false))
    } else {
      setSc(defaultScenario())
    }
  }, [scenarioId])

  const update = <K extends keyof Scenario>(field: K, value: Scenario[K]) => {
    setSc(prev => ({ ...prev, [field]: value }))
  }

  const save = async () => {
    setSaving(true); setErr('')
    try {
      const out = scenarioId
        ? await api.updateScenario(scenarioId, sc)
        : await api.createScenario(sc)
      onSaved(out)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const doDelete = async () => {
    if (!scenarioId) return
    try {
      await api.deleteScenario(scenarioId)
      onDeleted?.(scenarioId)
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  if (loading) {
    return <div className="R"><div className="load-splash">Loading&hellip;</div></div>
  }

  return (
    <div className="R">
      <div className="hub">
        <div className="hub-head">
          <div className="st">{scenarioId ? 'Edit scenario' : 'New scenario'}</div>
          <p className="ss">A reusable setup: overview, style and lore.</p>
        </div>

        {err && <div className="er">{err}</div>}

        <div className="gr" style={{ width: '100%' }}>
          <label className="lb">Name</label>
          <div style={{ display: 'flex', gap: '.3rem', alignItems: 'center' }}>
            <input
              type="text"
              value={sc.name}
              onChange={e => update('name', e.target.value)}
              placeholder="Scenario name"
              style={{ flex: 1 }}
            />
            <SuggestNameButton
              kind="scenario"
              text={sc.overview}
              context={{ overview: sc.overview }}
              disabled={!sc.overview.trim()}
              onSuggest={n => update('name', n)}
            />
          </div>
        </div>

        <div className="gr" style={{ width: '100%' }}>
          <label className="lb">Short description</label>
          <input
            type="text"
            value={sc.description}
            onChange={e => update('description', e.target.value)}
            placeholder='One-line pitch, shown on the picker'
          />
        </div>

        <div className="gr" style={{ width: '100%' }}>
          <label className="lb">Overview</label>
          <textarea
            value={sc.overview}
            onChange={e => update('overview', e.target.value)}
            rows={4}
            placeholder='e.g. "A rogue thief in a steampunk city"'
          />
        </div>

        <div className="gr" style={{ width: '100%' }}>
          <label className="lb">Writing style (optional)</label>
          <input
            type="text"
            value={sc.cStyle}
            onChange={e => update('cStyle', e.target.value)}
            placeholder='e.g. "dark and literary"'
          />
        </div>

        <div className="sr">
          <div>
            <label className="lb">Length</label>
            <select value={sc.style} onChange={e => update('style', e.target.value)}>
              {STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="lb">Difficulty</label>
            <select value={sc.diff} onChange={e => update('diff', e.target.value)}>
              <option value="normal">Normal</option>
              <option value="hard">Hard (permadeath)</option>
            </select>
          </div>
        </div>

        <div className="gr" style={{ width: '100%' }}>
          <label className="lb">Lore</label>
          <LoreEditor
            lore={sc.lore}
            onChange={next => update('lore', next)}
            aiContext={{ overview: sc.overview }}
          />
        </div>

        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <button className="b ba" disabled={saving || !sc.name.trim()} onClick={save} style={{ flex: 1, padding: '.65rem', fontWeight: 600 }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button className="b bs" onClick={onCancel}>Cancel</button>
        </div>

        {scenarioId && onDeleted && (
          cfmDelete ? (
            <div className="cf">
              <span style={{ fontSize: '.82rem', flex: 1 }}>Delete this scenario?</span>
              <button className="b bs" style={{ background: 'var(--dng)', borderColor: 'var(--dng)', color: '#fff' }} onClick={doDelete}>Yes</button>
              <button className="b bs" onClick={() => setCfmDelete(false)}>No</button>
            </div>
          ) : (
            <button className="b bs" style={{ color: 'var(--dng)' }} onClick={() => setCfmDelete(true)}>Delete scenario</button>
          )
        )}
      </div>
    </div>
  )
}
