import { useEffect, useState } from 'react'
import type { Scenario } from '../types'
import * as api from '../api'

interface Props {
  show: boolean
  onClose: () => void
  onPick: (scenarioId?: string) => void
  onEditScenario?: (id: string) => void
  onNewScenario?: () => void
  refreshKey?: number
}

export default function ScenarioPicker({ show, onClose, onPick, onEditScenario, onNewScenario, refreshKey = 0 }: Props) {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!show) return
    setLoading(true)
    api.listScenarios()
      .then(setScenarios)
      .catch(() => setScenarios([]))
      .finally(() => setLoading(false))
  }, [show, refreshKey])

  if (!show) return null

  return (
    <>
      <div className="mov" onClick={onClose} />
      <div className="mdl">
        <div className="mdl-h">Start new adventure</div>
        <div className="spk-grid">
          <button className="spk-card" onClick={() => { onPick(); onClose() }}>
            <div className="spk-name">Blank</div>
            <div className="spk-desc">Write your own adventure from scratch.</div>
          </button>

          {loading && <div className="spk-card spk-muted"><div className="spk-name">Loading...</div></div>}

          {!loading && scenarios.map(sc => (
            <div key={sc.id} className="spk-card" style={{ position: 'relative' }}>
              <div onClick={() => { onPick(sc.id); onClose() }} style={{ cursor: 'pointer' }}>
                <div className="spk-name">{sc.name || 'Scenario'}</div>
                <div className="spk-desc">{sc.description || sc.overview.slice(0, 120) || 'No description'}</div>
              </div>
              {onEditScenario && (
                <button
                  className="sgn"
                  style={{ position: 'absolute', top: '.35rem', right: '.35rem' }}
                  onClick={(e) => { e.stopPropagation(); onClose(); onEditScenario(sc.id) }}
                  title="Edit scenario"
                >Edit</button>
              )}
            </div>
          ))}
        </div>
        <div className="mdl-f">
          {onNewScenario && (
            <button className="b bs" onClick={() => { onClose(); onNewScenario() }}>+ New scenario</button>
          )}
          <button className="b bs" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </>
  )
}
