import { useState } from 'react'
import { X } from 'lucide-react'
import type { LoreEntry, Note, GalleryImage, GameState } from '../../types'
import { STYLES } from '../../types'
import PanelTabs from '../PanelTabs'
import type { PanelId } from '../PanelTabs'
import LoreEditor from '../LoreEditor'
import NotesEditor from '../NotesEditor'
import ModalTextField from '../ModalTextField'

type SubTab = 'main' | 'lore' | 'notes'

interface Props {
  show: boolean
  onClose: () => void
  lore: LoreEntry[]
  notes: Note[]
  dispatch: React.Dispatch<any>
  galleryImages?: GalleryImage[]
  onGenerateImage?: (loreId: string) => void
  story?: string
  overview: string
  summariesText?: string
  onSwitch?: (panel: PanelId) => void
  style: string
  cStyle: string
  imgStyle?: string
  diff: string
  setField: <K extends keyof GameState>(field: K, value: GameState[K]) => void
}

export default function StoryPanel({
  show, onClose, lore, notes, dispatch,
  galleryImages = [], onGenerateImage,
  story = '', overview, summariesText = '',
  onSwitch,
  style, cStyle, imgStyle = '', diff, setField,
}: Props) {
  const [sub, setSub] = useState<SubTab>('main')
  const enabledCount = lore.filter(l => l.enabled).length
  const headerSuffix =
    sub === 'lore' ? ` \u2014 Lore (${enabledCount}/${lore.length})` :
    sub === 'notes' ? ` \u2014 Notes (${notes.length})` : ''

  return (
    <>
      <div className={`ov ${show ? 'o' : ''}`} onClick={onClose} />
      <div className={`pn ${show ? 'o' : ''}`}>
        <div className="ph">
          <span>Story{headerSuffix}</span>
          <button className="b bs" onClick={onClose} aria-label="Close panel"><X size={16} className="ic" /></button>
        </div>
        {onSwitch && <PanelTabs active="story" onSwitch={onSwitch} />}

        <div className="pt">
          <button className={`pt-t${sub === 'main' ? ' pt-a' : ''}`} onClick={() => setSub('main')}>Main</button>
          <button className={`pt-t${sub === 'lore' ? ' pt-a' : ''}`} onClick={() => setSub('lore')}>Lore</button>
          <button className={`pt-t${sub === 'notes' ? ' pt-a' : ''}`} onClick={() => setSub('notes')}>Notes</button>
        </div>

        {sub === 'main' ? (
          <>
            <div className="gr">
              <label className="lb">Adventure Overview</label>
              <ModalTextField value={overview} onChange={v => setField('overview', v)} placeholder="What it's about..." lines={3} title="Adventure overview" />
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
              <ModalTextField value={cStyle} onChange={v => setField('cStyle', v)} placeholder='e.g. "Lovecraftian horror"' lines={3} title="Custom writing style" />
              <div className="hint">Overrides default style when set.</div>
            </div>

            <div className="gr">
              <label className="lb">Image Style</label>
              <ModalTextField value={imgStyle} onChange={v => setField('imgStyle', v)} placeholder='e.g. "gritty oil painting, muted earth tones, chiaroscuro"' lines={3} title="Image style (art direction)" />
              <div className="hint">Passed to the image-prompt AI as a binding art-direction constraint.</div>
            </div>

            <div className="gr">
              <label className="lb">Response Length</label>
              <select value={style} onChange={e => setField('style', e.target.value)}>
                {STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </>
        ) : sub === 'lore' ? (
          <LoreEditor
            lore={lore}
            onChange={next => dispatch({ type: 'SET_LORE', lore: next })}
            galleryImages={galleryImages}
            onGenerateImage={onGenerateImage}
            aiContext={{ story, overview, summaries: summariesText }}
          />
        ) : (
          <NotesEditor
            notes={notes}
            onAdd={note => dispatch({ type: 'ADD_NOTE', note })}
            onUpdate={(id, body) => dispatch({ type: 'UPDATE_NOTE', id, body })}
            onDelete={id => dispatch({ type: 'DELETE_NOTE', id })}
          />
        )}
      </div>
    </>
  )
}
