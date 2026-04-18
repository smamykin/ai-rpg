import { useEffect, useState } from 'react'
import type { GameState } from '../types'
import * as api from '../api'
import SuggestNameButton from './SuggestNameButton'

interface Props {
  show: boolean
  onClose: () => void
  state: Pick<GameState, 'name' | 'overview' | 'cStyle' | 'style' | 'diff' | 'lore' | 'secs'>
  onSaved?: () => void
}

export default function SaveAsScenarioModal({ show, onClose, state, onSaved }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedLore, setSelectedLore] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!show) return
    setName(state.name || '')
    setDescription('')
    setSelectedLore(new Set(state.lore.map(l => l.id)))
    setErr('')
  }, [show, state])

  if (!show) return null

  const toggle = (id: string) => {
    setSelectedLore(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const save = async () => {
    setBusy(true); setErr('')
    try {
      const lore = state.lore.filter(l => selectedLore.has(l.id))
      await api.createScenario({
        name: name.trim() || 'Scenario',
        description: description.trim(),
        overview: state.overview,
        cStyle: state.cStyle,
        style: state.style,
        diff: state.diff,
        lore,
        secs: [],  // sections are session-state artifacts, not template material — skip
      })
      onSaved?.()
      onClose()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="mov" onClick={onClose} />
      <div className="mdl">
        <div className="mdl-h">Save as scenario</div>

        {err && <div className="er">{err}</div>}

        <div className="gr">
          <label className="lb">Name</label>
          <div style={{ display: 'flex', gap: '.3rem', alignItems: 'center' }}>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Scenario name"
              style={{ flex: 1 }}
            />
            <SuggestNameButton
              kind="scenario"
              text={state.overview}
              context={{ overview: state.overview }}
              disabled={!state.overview.trim()}
              onSuggest={setName}
            />
          </div>
        </div>

        <div className="gr">
          <label className="lb">Short description (optional)</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="One-line pitch, shown on the picker"
          />
        </div>

        {state.lore.length > 0 && (
          <div className="gr">
            <label className="lb">Lore to include ({selectedLore.size}/{state.lore.length})</label>
            <div className="sas-lore">
              {state.lore.map(l => (
                <label key={l.id} className="sas-lore-row">
                  <input
                    type="checkbox"
                    checked={selectedLore.has(l.id)}
                    onChange={() => toggle(l.id)}
                  />
                  <span className="sas-lore-nm">{l.name || '(untitled)'}</span>
                  <span className="sas-lore-tg">{l.tag}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="mdl-f">
          <button className="b bs" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="b ba bs" onClick={save} disabled={busy || !name.trim()}>
            {busy ? 'Saving...' : 'Save scenario'}
          </button>
        </div>
      </div>
    </>
  )
}
