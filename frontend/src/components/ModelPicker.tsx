import { useMemo } from 'react'
import type { ModelInfo } from '../types'

interface Props {
  id: string
  value: string
  onChange: (value: string) => void
  models: ModelInfo[]
  placeholder?: string
}

export default function ModelPicker({ id, value, onChange, models, placeholder }: Props) {
  const listId = `dl-${id}`

  const info = useMemo(() => {
    const m = models.find(x => x.id === value)
    if (!m) return null
    const bits: string[] = []
    if (m.ctx) bits.push(`${Math.round(m.ctx / 1000)}k ctx`)
    if (m.price != null) bits.push(`$${m.price.toFixed(2)}/1M in`)
    return bits.join(' \u00b7 ')
  }, [value, models])

  return (
    <div>
      <input
        type="text"
        list={listId}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || 'Type to search\u2026'}
        autoComplete="off"
        spellCheck={false}
      />
      <datalist id={listId}>
        {models.map(m => (
          <option key={m.id} value={m.id}>
            {m.name !== m.id ? `${m.name} \u2014 ${m.id}` : m.id}
          </option>
        ))}
      </datalist>
      {info && <div className="mcount">{info}</div>}
    </div>
  )
}
