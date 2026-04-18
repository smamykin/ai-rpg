import { useState } from 'react'
import * as api from '../api'
import type { SuggestNameCtx } from '../api'

interface Props {
  kind: 'lore' | 'session' | 'scenario'
  text: string
  tag?: string
  context?: SuggestNameCtx
  disabled?: boolean
  onSuggest: (name: string) => void
  label?: string
}

export default function SuggestNameButton({ kind, text, tag, context, disabled, onSuggest, label }: Props) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const click = async () => {
    if (busy || disabled) return
    setBusy(true); setErr('')
    try {
      const name = await api.suggestName(kind, text, tag, context)
      if (name) onSuggest(name)
    } catch (e) {
      setErr((e as Error).message || 'Failed')
    }
    setBusy(false)
  }

  return (
    <button
      className="sgn"
      onClick={click}
      disabled={busy || disabled}
      title={err || 'Suggest a name'}
      style={err ? { borderColor: 'var(--dng)', color: 'var(--dng)' } : undefined}
    >
      {busy ? <span className="sgn-sp">&#x21bb;</span> : err ? '\u26A0' : '\u2728'} {label ?? 'Suggest'}
    </button>
  )
}
