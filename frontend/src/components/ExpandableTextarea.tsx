import { forwardRef, useState, type TextareaHTMLAttributes } from 'react'
import { Expand } from 'lucide-react'
import EditorModal from './EditorModal'

interface Props extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  value: string
  onChange: (value: string) => void
  title?: string
}

const ExpandableTextarea = forwardRef<HTMLTextAreaElement, Props>(function ExpandableTextarea(
  { value, onChange, title, placeholder, className, ...rest }, ref,
) {
  const [open, setOpen] = useState(false)
  return (
    <div className="exta-wrap">
      <textarea
        {...rest}
        ref={ref}
        className={className}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <button
        type="button"
        className="exta-btn"
        onClick={() => setOpen(true)}
        aria-label="Expand editor"
        title="Expand editor"
      >
        <Expand size={12} className="ic ic-muted" />
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
    </div>
  )
})

export default ExpandableTextarea
