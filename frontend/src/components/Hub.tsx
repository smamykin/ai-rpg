import { useState } from 'react'
import type { SessionMeta } from '../types'
import ScenarioPicker from './ScenarioPicker'
import SuggestNameButton from './SuggestNameButton'

interface Props {
  sessions: SessionMeta[]
  current: string
  busy: boolean
  onSwitch: (id: string) => void
  onCreate: (name: string, scenarioId?: string) => Promise<unknown>
  onRename: (id: string, name: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  scenariosVersion?: number
  onEditScenario?: (id: string) => void
  onNewScenario?: () => void
}

function formatDate(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function Hub({ sessions, current, busy, onSwitch, onCreate, onRename, onDelete, scenariosVersion, onEditScenario, onNewScenario }: Props) {
  const [showPicker, setShowPicker] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const startEdit = (s: SessionMeta) => {
    setEditingId(s.id)
    setEditName(s.name)
  }

  const commitEdit = async () => {
    if (!editingId) return
    const next = editName.trim()
    if (next) await onRename(editingId, next)
    setEditingId(null)
  }

  const handleCreate = async (scenarioId?: string) => {
    await onCreate('Adventure', scenarioId)
  }

  const handleNewScenario = () => {
    onNewScenario?.()
  }

  const handleEditScenario = (id: string) => {
    onEditScenario?.(id)
  }

  return (
    <div className="R">
      <div className="hub">
        <div className="hub-head">
          <div className="st">AI RPG</div>
          <p className="ss">Your adventures</p>
        </div>

        <button
          className="b ba hub-new"
          disabled={busy}
          onClick={() => setShowPicker(true)}
        >
          + New adventure
        </button>

        {sessions.length === 0 ? (
          <div className="hub-empty">No adventures yet. Start a new one above.</div>
        ) : (
          <div className="hub-list">
            {sessions.map(s => (
              <div key={s.id} className={`hub-card ${s.id === current ? 'hub-cur' : ''}`}>
                <div
                  className="hub-card-body"
                  onClick={() => { if (editingId === s.id) { commitEdit() } else { onSwitch(s.id) } }}
                >
                  {editingId === s.id ? (
                    <div
                      style={{ display: 'flex', gap: '.3rem', alignItems: 'center' }}
                      onClick={e => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        value={editName}
                        autoFocus
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(); else if (e.key === 'Escape') setEditingId(null) }}
                        className="hub-name-in"
                        style={{ flex: 1 }}
                      />
                      <SuggestNameButton
                        kind="session"
                        text={s.overviewHead || ''}
                        context={{ overview: s.overviewHead || '' }}
                        disabled={!s.overviewHead}
                        onSuggest={n => setEditName(n)}
                      />
                      <button className="sgn" onClick={commitEdit} title="Save name">&#x2713; Save</button>
                      <button className="sgn" onClick={() => setEditingId(null)} title="Cancel">&#x2715;</button>
                    </div>
                  ) : (
                    <div className="hub-name">{s.name || 'Adventure'}</div>
                  )}
                  <div className="hub-meta">
                    <span>{formatDate(s.lastPlayedAt)}</span>
                    <span>·</span>
                    <span>{s.storyChars ? `${Math.round(s.storyChars / 1000)}k chars` : 'empty'}</span>
                  </div>
                  {s.overviewHead && <div className="hub-over">{s.overviewHead}</div>}
                </div>
                <div className="hub-card-act">
                  <button className="b bs" onClick={(e) => { e.stopPropagation(); startEdit(s) }}>Rename</button>
                  {confirmId === s.id ? (
                    <>
                      <button
                        className="b bs"
                        style={{ background: 'var(--dng)', borderColor: 'var(--dng)', color: '#fff' }}
                        onClick={async (e) => { e.stopPropagation(); await onDelete(s.id); setConfirmId(null) }}
                      >Confirm</button>
                      <button className="b bs" onClick={(e) => { e.stopPropagation(); setConfirmId(null) }}>Cancel</button>
                    </>
                  ) : (
                    <button className="b bs" onClick={(e) => { e.stopPropagation(); setConfirmId(s.id) }}>Delete</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ScenarioPicker
        show={showPicker}
        onClose={() => setShowPicker(false)}
        onPick={handleCreate}
        onEditScenario={onEditScenario ? handleEditScenario : undefined}
        onNewScenario={onNewScenario ? handleNewScenario : undefined}
        refreshKey={scenariosVersion}
      />
    </div>
  )
}
