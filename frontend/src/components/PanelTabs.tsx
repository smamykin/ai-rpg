export type PanelId = 'story' | 'gallery' | 'track' | 'settings' | 'prompt'

const TABS: { id: PanelId; label: string }[] = [
  { id: 'story', label: 'Str' },
  { id: 'gallery', label: 'Gal' },
  { id: 'track', label: 'Trk' },
  { id: 'settings', label: 'Set' },
  { id: 'prompt', label: 'Pv' },
]

interface Props {
  active: PanelId
  onSwitch: (id: PanelId) => void
  visibleTabs?: PanelId[]
}

export default function PanelTabs({ active, onSwitch, visibleTabs }: Props) {
  const shown = visibleTabs ? TABS.filter(t => visibleTabs.includes(t.id)) : TABS
  if (shown.length <= 1) return null
  return (
    <div className="pt">
      {shown.map(t => (
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
