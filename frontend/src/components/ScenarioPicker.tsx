import { useEffect, useRef, useState } from 'react'
import type { Scenario } from '../types'
import { validateScenario } from '../types'
import { SCENARIO_CREATION_PROMPT } from '../constants/scenarioPrompt'
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
  const [err, setErr] = useState('')
  const [importing, setImporting] = useState(false)
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!show) return
    setErr('')
    setLoading(true)
    api.listScenarios()
      .then(setScenarios)
      .catch(() => setScenarios([]))
      .finally(() => setLoading(false))
  }, [show, refreshKey])

  const onCopyPrompt = async () => {
    setErr('')
    try {
      await navigator.clipboard.writeText(SCENARIO_CREATION_PROMPT)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setErr('Could not copy to clipboard')
    }
  }

  const importFromText = async (text: string, sourceLabel: string) => {
    setErr('')
    setImporting(true)
    try {
      let obj: unknown
      try { obj = JSON.parse(text) } catch { throw new Error(`${sourceLabel} is not valid JSON`) }
      const cleaned = validateScenario(obj)
      if (!cleaned) throw new Error(`${sourceLabel} is not a scenario (missing name/overview)`)
      const created = await api.createScenario(cleaned)
      setScenarios(prev => [created, ...prev.filter(s => s.id !== created.id)])
    } catch (ex) {
      setErr((ex as Error).message)
    } finally {
      setImporting(false)
    }
  }

  const onFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (e.target) e.target.value = ''
    if (!file) return
    const text = await file.text()
    await importFromText(text, 'File')
  }

  const onPasteImport = async () => {
    setErr('')
    try {
      const text = await navigator.clipboard.readText()
      if (!text.trim()) { setErr('Clipboard is empty'); return }
      await importFromText(text, 'Clipboard')
    } catch {
      setErr('Could not read from clipboard')
    }
  }

  if (!show) return null

  return (
    <>
      <div className="mov" onClick={onClose} />
      <div className="mdl">
        <div className="mdl-h">Start new adventure</div>
        {err && <div className="er" style={{ margin: '0 0 .5rem' }}>{err}</div>}
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
          <button
            className="b bs"
            onClick={onCopyPrompt}
            title="Copy an AI prompt that helps you design a scenario; paste the JSON it returns into Import"
          >
            {copied ? '\u2713 Prompt copied' : 'Scenario creation prompt'}
          </button>
          <button className="b bs" disabled={importing} onClick={onPasteImport}>
            {importing ? 'Importing...' : 'Paste'}
          </button>
          <button className="b bs" disabled={importing} onClick={() => fileRef.current?.click()}>
            {importing ? 'Importing...' : 'Import file'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={onFilePick}
          />
          <button className="b bs" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </>
  )
}
