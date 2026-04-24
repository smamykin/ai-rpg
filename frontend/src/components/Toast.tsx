import { X } from 'lucide-react'
import type { Toast as ToastType } from '../hooks/useToast'

interface Props {
  toasts: ToastType[]
  onDismiss: (id: number) => void
}

export default function ToastContainer({ toasts, onDismiss }: Props) {
  if (!toasts.length) return null
  return (
    <div className="tc">
      {toasts.map(t => (
        <div key={t.id} className={`t t-${t.type[0]}`}>
          <span>{t.message}</span>
          <button className="t-x" onClick={() => onDismiss(t.id)} aria-label="Dismiss"><X size={14} className="ic ic-muted" /></button>
        </div>
      ))}
    </div>
  )
}
