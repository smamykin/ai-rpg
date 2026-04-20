export type PanelId = 'mem' | 'gallery' | 'track' | 'settings' | 'ai' | 'prompt'

const TABS: { id: PanelId; label: string }[] = [
  { id: 'mem', label: 'Mem' },
  { id: 'gallery', label: 'Gal' },
  { id: 'track', label: 'Trk' },
  { id: 'settings', label: 'Set' },
  { id: 'ai', label: 'AI' },
  { id: 'prompt', label: 'Pv' },
]

interface Props {
  active: PanelId
  onSwitch: (id: PanelId) => void
}

export default function PanelTabs({ active, onSwitch }: Props) {
  return (
    <div className="pt">
      {TABS.map(t => (
        <button
          key={t.id}
          className={`pt-t${active === t.id ? ' pt-a' : ''}`}
          onClick={() => onSwitch(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
