import { useState } from 'react'
import * as api from '../api'

interface Props {
  show: boolean
  storedMajor: number
  storedMinor: number
  currentMajor: number
  currentMinor: number
}

export default function SchemaWipeModal({ show, storedMajor, storedMinor, currentMajor, currentMinor }: Props) {
  const [working, setWorking] = useState(false)
  const [err, setErr] = useState('')
  if (!show) return null

  const onWipe = async () => {
    setWorking(true)
    setErr('')
    try {
      await api.resetAllData()
      try { localStorage.clear() } catch { /* ignore */ }
      window.location.reload()
    } catch (e) {
      setWorking(false)
      setErr(e instanceof Error ? e.message : 'Failed to clear data')
    }
  }

  return (
    <>
      <div className="mov" />
      <div className="mdl">
        <div className="mdl-h">Update — full reset required</div>
        <p style={{ lineHeight: 1.45 }}>
          A new major version of the app has rolled out. Stored data is on
          schema <strong>{storedMajor}.{storedMinor}</strong> but this build
          requires <strong>{currentMajor}.{currentMinor}</strong>. There's no
          in-place migration path for this jump, so you have to clear all
          local data before continuing.
        </p>
        <p style={{ lineHeight: 1.45, fontSize: '.88rem', color: 'var(--mt)' }}>
          This wipes every session, scenario, and gallery image stored on the server
          and in this browser. Export anything you want to keep first.
        </p>
        {err && <p style={{ color: 'var(--dng)', fontSize: '.88rem' }}>{err}</p>}
        <div className="mdl-f">
          <button
            className="b ba"
            onClick={onWipe}
            disabled={working}
            style={{ background: 'var(--dng)', borderColor: 'var(--dng)', color: '#fff' }}
          >
            {working ? 'Clearing…' : 'Clear all data & reload'}
          </button>
        </div>
      </div>
    </>
  )
}
