import { useState } from 'react'
import { RotateCw, AlertTriangle, Sparkles } from 'lucide-react'
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
      {busy ? <span className="sgn-sp"><RotateCw size={12} className="ic" /></span> : err ? <AlertTriangle size={12} className="ic ic-danger" /> : <Sparkles size={12} className="ic ic-accent" />} {label ?? 'Suggest'}
    </button>
  )
}
