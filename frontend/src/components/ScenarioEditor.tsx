import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { GameState, Scenario, Section } from '../types'
import { defaultScenario, STYLES, uid } from '../types'
import LoreEditor from './LoreEditor'
import RollVariantsEditor from './RollVariantsEditor'
import SuggestNameButton from './SuggestNameButton'
import ExpandableTextarea from './ExpandableTextarea'
import GlobalMenu from './GlobalMenu'
import * as api from '../api'

type EditorTab = 'main' | 'lore' | 'tracked' | 'rolls'

const TABS: { id: EditorTab; label: string }[] = [
  { id: 'main', label: 'Main' },
  { id: 'lore', label: 'Lore' },
  { id: 'tracked', label: 'Tracked' },
  { id: 'rolls', label: 'Rolls' },
]

const MAX_SECS = 5

interface Props {
  scenarioId: string | null  // null = creating new
  onSaved: (sc: Scenario) => void
  onCancel: () => void
  onDeleted?: (id: string) => void
  state: GameState
  dispatch: React.Dispatch<any>
  setField: <K extends keyof GameState>(field: K, value: GameState[K]) => void
}

function filenameFor(name: string): string {
  const s = (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  return s || 'scenario'
}

export default function ScenarioEditor({ scenarioId, onSaved, onCancel, onDeleted, state, dispatch, setField }: Props) {
  const [sc, setSc] = useState<Scenario>(() => defaultScenario())
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [cfmDelete, setCfmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<EditorTab>('main')
  const [nName, setNName] = useState('')
  const [nDesc, setNDesc] = useState('')
  const [nContent, setNContent] = useState('')

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

  const updateSec = (id: string, patch: Partial<Section>) => {
    update('secs', sc.secs.map(s => s.id === id ? { ...s, ...patch } : s))
  }

  const removeSec = (id: string) => {
    update('secs', sc.secs.filter(s => s.id !== id))
  }

  const addSec = () => {
    if (!nName.trim() || sc.secs.length >= MAX_SECS) return
    update('secs', [...sc.secs, { id: uid(), name: nName.trim(), description: nDesc.trim(), content: nContent }])
    setNName('')
    setNDesc('')
    setNContent('')
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

  const doExport = () => {
    const data = JSON.stringify(sc, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filenameFor(sc.name) + '.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="R">
        <div className="hd">
          <h1>{scenarioId ? 'Edit scenario' : 'New scenario'}</h1>
          <GlobalMenu state={state} dispatch={dispatch} setField={setField} />
        </div>
        <div className="load-splash">Loading&hellip;</div>
      </div>
    )
  }

  return (
    <div className="R">
      <div className="hd">
        <h1>{scenarioId ? 'Edit scenario' : 'New scenario'}</h1>
        <GlobalMenu state={state} dispatch={dispatch} setField={setField} />
      </div>

      <div className="hub">
        <div className="hub-head">
          <p className="ss">A reusable setup: overview, style, lore and tracked stats.</p>
        </div>

        {err && <div className="er">{err}</div>}

        <div className="pt">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`pt-t${tab === t.id ? ' pt-a' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.id === 'lore' && sc.lore.length > 0 ? `${t.label} (${sc.lore.length})`
                : t.id === 'tracked' && sc.secs.length > 0 ? `${t.label} (${sc.secs.length})`
                : t.id === 'rolls' && (sc.rollVariants?.length || 0) > 0 ? `${t.label} (${sc.rollVariants.length})`
                : t.label}
            </button>
          ))}
        </div>

        {tab === 'main' && (
          <>
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
              <ExpandableTextarea
                value={sc.overview}
                onChange={v => update('overview', v)}
                rows={4}
                placeholder='e.g. "A rogue thief in a steampunk city"'
                title="Scenario overview"
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
          </>
        )}

        {tab === 'lore' && (
          <div className="gr" style={{ width: '100%' }}>
            <LoreEditor
              lore={sc.lore}
              onChange={next => update('lore', next)}
              aiContext={{ overview: sc.overview }}
            />
          </div>
        )}

        {tab === 'tracked' && (
          <div style={{ width: '100%' }}>
            {sc.secs.length < MAX_SECS && (
              <div className="ax">
                <label className="lb">Add tracked entry {sc.secs.length > 0 ? `(${sc.secs.length}/${MAX_SECS})` : ''}</label>
                <input
                  type="text"
                  value={nName}
                  onChange={e => setNName(e.target.value)}
                  placeholder="Name (e.g. Inventory, Health)"
                  style={{ marginBottom: '.35rem', fontSize: '.85rem', padding: '.4rem .6rem' }}
                />
                <textarea
                  value={nDesc}
                  onChange={e => setNDesc(e.target.value)}
                  placeholder="What to track and when to update it"
                  rows={2}
                  style={{ fontSize: '.82rem', padding: '.4rem .6rem', marginBottom: '.35rem' }}
                />
                <textarea
                  value={nContent}
                  onChange={e => setNContent(e.target.value)}
                  placeholder='Starting content (optional, e.g. "HP: 100/100")'
                  rows={3}
                  style={{ fontSize: '.82rem', padding: '.4rem .6rem', marginBottom: '.35rem', fontFamily: "'Crimson Pro', serif" }}
                />
                <button className="b bs ba" onClick={addSec} disabled={!nName.trim()}>+ Add</button>
              </div>
            )}

            {sc.secs.map(s => (
              <div key={s.id} className="sc">
                <div className="sh">
                  <input
                    type="text"
                    value={s.name}
                    onChange={e => updateSec(s.id, { name: e.target.value })}
                    placeholder="Name"
                    style={{ flex: 1, fontWeight: 600, fontSize: '.88rem', color: 'var(--ac)', padding: '.3rem .45rem', marginRight: '.4rem' }}
                  />
                  <button
                    className="b bs"
                    onClick={() => removeSec(s.id)}
                    style={{ padding: '.15rem .4rem', fontSize: '.68rem' }}
                    aria-label="Remove section"
                  ><X size={12} className="ic ic-muted" /></button>
                </div>
                <textarea
                  value={s.description}
                  onChange={e => updateSec(s.id, { description: e.target.value })}
                  placeholder="What to track and when to update it"
                  rows={2}
                  style={{ fontSize: '.78rem', padding: '.35rem .45rem', marginBottom: '.35rem', fontStyle: 'italic', color: 'var(--mt)' }}
                />
                <label className="lb" style={{ marginTop: '.15rem' }}>Starting content</label>
                <textarea
                  className="st2"
                  value={s.content}
                  onChange={e => updateSec(s.id, { content: e.target.value })}
                  placeholder='e.g. HP: 100/100, Mana: 50/50'
                  rows={4}
                />
              </div>
            ))}

            {sc.secs.length === 0 && (
              <p style={{ color: 'var(--mt)', fontSize: '.85rem', textAlign: 'center', padding: '1rem 0' }}>
                No tracked entries yet. Add one above to pre-fill session state.
              </p>
            )}
          </div>
        )}

        {tab === 'rolls' && (
          <div style={{ width: '100%' }}>
            <RollVariantsEditor
              variants={sc.rollVariants || []}
              lore={sc.lore}
              diceRulesLoreId={sc.diceRulesLoreId || ''}
              onChange={next => update('rollVariants', next)}
              onSetRulesLore={id => update('diceRulesLoreId', id)}
              onAddLore={entry => update('lore', [...sc.lore, entry])}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <button className="b ba" disabled={saving || !sc.name.trim()} onClick={save} style={{ flex: 1, padding: '.65rem', fontWeight: 600 }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          {scenarioId && (
            <button className="b bs" onClick={doExport} title="Download scenario as JSON">Export</button>
          )}
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
