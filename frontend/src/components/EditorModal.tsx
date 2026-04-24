import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ExtraAction {
  label: string
  onClick: () => void
  danger?: boolean
}

interface Props {
  title: string
  value: string
  placeholder?: string
  onSave: (value: string) => void
  onClose: () => void
  extraActions?: ExtraAction[]
}

export default function EditorModal({ title, value, placeholder, onSave, onClose, extraActions }: Props) {
  const [draft, setDraft] = useState(value)
  const ta = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ta.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
    el.scrollTop = el.scrollHeight
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        onSave(draft)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [draft, onSave, onClose])

  return createPortal(
    <>
      <div className="mov" onClick={onClose} />
      <div className="emd" onClick={e => e.stopPropagation()}>
        <div className="emd-h">
          <span>{title}</span>
          <button className="b bs" onClick={onClose} aria-label="Close"><X size={16} className="ic" /></button>
        </div>
        <textarea
          ref={ta}
          className="emd-ta"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder={placeholder}
          spellCheck
        />
        <div className="emd-ft">
          {extraActions?.map((a, i) => (
            <button
              key={i}
              className="b bs"
              onClick={a.onClick}
              style={a.danger ? { color: 'var(--dng)', marginRight: 'auto' } : { marginRight: 'auto' }}
            >{a.label}</button>
          ))}
          <button className="b bs" onClick={onClose}>Cancel</button>
          <button className="b bs ba" onClick={() => onSave(draft)}>Save</button>
        </div>
      </div>
    </>,
    document.body,
  )
}
