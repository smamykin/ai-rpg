import { useState } from 'react'
import { Expand } from 'lucide-react'
import EditorModal from './EditorModal'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  title?: string
  lines?: number
  className?: string
}

export default function ModalTextField({
  value, onChange, placeholder, title, lines = 2, className,
}: Props) {
  const [open, setOpen] = useState(false)
  const empty = !value.trim()
  return (
    <>
      <button
        type="button"
        className={`mtf ${empty ? 'mtf-e' : ''} ${className || ''}`}
        style={{ ['--mtf-lines' as string]: lines }}
        onClick={() => setOpen(true)}
        title="Click to edit"
      >
        <span className="mtf-v">{empty ? (placeholder || 'Click to edit…') : value}</span>
        <span className="mtf-i" aria-hidden><Expand size={12} className="ic" /></span>
      </button>
      {open && (
        <EditorModal
          title={title || 'Edit'}
          value={value}
          placeholder={placeholder}
          onSave={v => { onChange(v); setOpen(false) }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
