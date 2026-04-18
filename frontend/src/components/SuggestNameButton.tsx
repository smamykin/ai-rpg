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

  const click = async () => {
    if (busy || disabled) return
    setBusy(true)
    try {
      const name = await api.suggestName(kind, text, tag, context)
      if (name) onSuggest(name)
    } catch { /* ignore */ }
    setBusy(false)
  }

  return (
    <button className="sgn" onClick={click} disabled={busy || disabled} title="Suggest a name">
      {busy ? <span className="sgn-sp">&#x21bb;</span> : '\u2728'} {label ?? 'Suggest'}
    </button>
  )
}
