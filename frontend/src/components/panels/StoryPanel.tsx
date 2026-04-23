import { useState } from 'react'
import type { LoreEntry, GalleryImage, GameState } from '../../types'
import { STYLES } from '../../types'
import PanelTabs from '../PanelTabs'
import type { PanelId } from '../PanelTabs'
import LoreEditor from '../LoreEditor'
import ExpandableTextarea from '../ExpandableTextarea'

type SubTab = 'main' | 'lore'

interface Props {
  show: boolean
  onClose: () => void
  lore: LoreEntry[]
  dispatch: React.Dispatch<any>
  galleryImages?: GalleryImage[]
  onGenerateImage?: (loreId: string) => void
  story?: string
  overview: string
  summariesText?: string
  onSwitch?: (panel: PanelId) => void
  style: string
  cStyle: string
  diff: string
  setField: <K extends keyof GameState>(field: K, value: GameState[K]) => void
}

export default function StoryPanel({
  show, onClose, lore, dispatch,
  galleryImages = [], onGenerateImage,
  story = '', overview, summariesText = '',
  onSwitch,
  style, cStyle, diff, setField,
}: Props) {
  const [sub, setSub] = useState<SubTab>('main')
  const enabledCount = lore.filter(l => l.enabled).length

  return (
    <>
      <div className={`ov ${show ? 'o' : ''}`} onClick={onClose} />
      <div className={`pn ${show ? 'o' : ''}`}>
        <div className="ph">
          <span>Story{sub === 'lore' ? ` \u2014 Lore (${enabledCount}/${lore.length})` : ''}</span>
          <button className="b bs" onClick={onClose}>&#x2715;</button>
        </div>
        {onSwitch && <PanelTabs active="story" onSwitch={onSwitch} />}

        <div className="pt">
          <button className={`pt-t${sub === 'main' ? ' pt-a' : ''}`} onClick={() => setSub('main')}>Main</button>
          <button className={`pt-t${sub === 'lore' ? ' pt-a' : ''}`} onClick={() => setSub('lore')}>Lore</button>
        </div>

        {sub === 'main' ? (
          <>
            <div className="gr">
              <label className="lb">Adventure Overview</label>
              <ExpandableTextarea value={overview} onChange={v => setField('overview', v)} placeholder="What it's about..." rows={3} title="Adventure overview" />
            </div>

            <div className="gr">
              <label className="lb">Difficulty</label>
              <select value={diff} onChange={e => setField('diff', e.target.value)}>
                <option value="normal">Normal</option>
                <option value="hard">Hard (permadeath)</option>
              </select>
            </div>

            <div className="gr">
              <label className="lb">Custom Writing Style</label>
              <ExpandableTextarea value={cStyle} onChange={v => setField('cStyle', v)} placeholder='e.g. "Lovecraftian horror"' rows={3} title="Custom writing style" />
              <div className="hint">Overrides default style when set.</div>
            </div>

            <div className="gr">
              <label className="lb">Response Length</label>
              <select value={style} onChange={e => setField('style', e.target.value)}>
                {STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </>
        ) : (
          <LoreEditor
            lore={lore}
            onChange={next => dispatch({ type: 'SET_LORE', lore: next })}
            galleryImages={galleryImages}
            onGenerateImage={onGenerateImage}
            aiContext={{ story, overview, summaries: summariesText }}
          />
        )}
      </div>
    </>
  )
}
