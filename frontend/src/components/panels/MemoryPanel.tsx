import type { LoreEntry, GalleryImage } from '../../types'
import PanelTabs from '../PanelTabs'
import type { PanelId } from '../PanelTabs'
import LoreEditor from '../LoreEditor'

interface Props {
  show: boolean
  onClose: () => void
  lore: LoreEntry[]
  dispatch: React.Dispatch<any>
  galleryImages?: GalleryImage[]
  onGenerateImage?: (loreId: string) => void
  story?: string
  overview?: string
  summariesText?: string
  onSwitch?: (panel: PanelId) => void
}

export default function MemoryPanel({
  show, onClose, lore,
  dispatch,
  galleryImages = [], onGenerateImage,
  story = '', overview = '',
  summariesText = '',
  onSwitch,
}: Props) {
  const enabledCount = lore.filter(l => l.enabled).length

  return (
    <>
      <div className={`ov ${show ? 'o' : ''}`} onClick={onClose} />
      <div className={`pn ${show ? 'o' : ''}`}>
        <div className="ph">
          <span>Lore ({enabledCount}/{lore.length})</span>
          <button className="b bs" onClick={onClose}>&#x2715;</button>
        </div>
        {onSwitch && <PanelTabs active="mem" onSwitch={onSwitch} />}

        <LoreEditor
          lore={lore}
          onChange={next => dispatch({ type: 'SET_LORE', lore: next })}
          galleryImages={galleryImages}
          onGenerateImage={onGenerateImage}
          aiContext={{ story, overview, summaries: summariesText }}
        />
      </div>
    </>
  )
}
