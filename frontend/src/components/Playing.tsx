import { useState } from 'react'
import StoryArea from './StoryArea'
import ActionInput from './ActionInput'
import AIPanel from './panels/AIPanel'
import MemoryPanel from './panels/MemoryPanel'
import TrackingPanel from './panels/TrackingPanel'
import SettingsPanel from './panels/SettingsPanel'
import MenuPanel from './panels/MenuPanel'
import type { GameState } from '../types'

interface Props {
  state: {
    story: string
    overview: string
    style: string
    cStyle: string
    diff: string
    arc: string
    storyModel: string
    supportModel: string
    gen: boolean
    streaming: string
    err: string
    mems: GameState['mems']
    addlMem: string
    secs: GameState['secs']
    auFreq: number
    summing: boolean
    stUp: boolean
  }
  dispatch: React.Dispatch<any>
  setField: <K extends keyof GameState>(field: K, value: GameState[K]) => void
  actions: {
    submit: (action: string) => void
    cont: () => void
    regen: () => void
    deleteLast: () => void
    stop: () => void
    doSummarize: () => void
    doUpdateStats: () => void
    newAdventure: () => void
    saveFile: () => void
    exportMd: () => void
    loadFile: () => void
  }
  computed: {
    wordCount: number
    canSummarize: boolean
    summarizeWordCount: number
  }
}

export default function Playing({ state, dispatch, setField, actions, computed }: Props) {
  const [showMem, setShowMem] = useState(false)
  const [showSt, setShowSt] = useState(false)
  const [showSet, setShowSet] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showArc, setShowArc] = useState(false)
  const [cfm, setCfm] = useState(false)

  return (
    <div className="R">
      {/* Header */}
      <div className="hd">
        <h1>{state.overview?.slice(0, 24) || 'AI RPG'}{state.overview && state.overview.length > 24 ? '\u2026' : ''}</h1>
        <div style={{ display: 'flex', gap: '.3rem', flexShrink: 0 }}>
          <button className="b bs" onClick={() => setShowMem(s => !s)}>
            Memory{state.mems.length > 0 && <span style={{ fontSize: '.65rem', marginLeft: 1 }}>{state.mems.length}</span>}
          </button>
          <button className="b bs" onClick={() => setShowSt(s => !s)}>
            Track{state.secs.length > 0 && <span style={{ fontSize: '.65rem', marginLeft: 1 }}>{state.secs.length}</span>}
          </button>
          <button className="b bs" onClick={() => setShowSet(s => !s)}>Settings</button>
          <button className="b bs" onClick={() => setShowAI(s => !s)}>AI</button>
          <div style={{ position: 'relative' }}>
            <button className="b bs" onClick={() => setShowMenu(m => !m)}>&hellip;</button>
            <MenuPanel
              show={showMenu}
              onClose={() => setShowMenu(false)}
              onSave={actions.saveFile}
              onExportMd={actions.exportMd}
              onLoad={actions.loadFile}
              onNew={() => setCfm(true)}
            />
          </div>
        </div>
      </div>

      {/* Confirm reset */}
      {cfm && (
        <div className="cf">
          <span style={{ fontSize: '.85rem', flex: 1 }}>Reset adventure?</span>
          <button className="b bs" style={{ background: 'var(--dng)', borderColor: 'var(--dng)', color: '#fff' }}
            onClick={() => { actions.newAdventure(); setCfm(false) }}>Yes</button>
          <button className="b bs" onClick={() => setCfm(false)}>No</button>
        </div>
      )}

      {/* Panels */}
      <AIPanel show={showAI} onClose={() => setShowAI(false)}
        storyModel={state.storyModel} supportModel={state.supportModel} setField={setField} />

      <MemoryPanel
        show={showMem} onClose={() => setShowMem(false)}
        mems={state.mems} addlMem={state.addlMem}
        wordCount={computed.wordCount}
        canSummarize={computed.canSummarize}
        summarizeWordCount={computed.summarizeWordCount}
        summing={state.summing}
        dispatch={dispatch} setField={setField}
        onSummarize={actions.doSummarize}
      />

      <TrackingPanel
        show={showSt} onClose={() => setShowSt(false)}
        secs={state.secs} auFreq={state.auFreq} stUp={state.stUp}
        dispatch={dispatch} setField={setField}
        onUpdateStats={actions.doUpdateStats}
      />

      <SettingsPanel
        show={showSet} onClose={() => setShowSet(false)}
        style={state.style} cStyle={state.cStyle}
        overview={state.overview} diff={state.diff}
        setField={setField}
      />

      {/* Story */}
      <StoryArea
        story={state.story}
        gen={state.gen}
        streaming={state.streaming}
        onChange={story => dispatch({ type: 'SET_STORY', story })}
      />

      {/* Status bars */}
      {state.gen && (
        <div className="gb">
          <span className="gd">&#x25cf;</span>
          {state.stUp ? 'Updating stats...' : 'Generating...'}
          <button className="b bs" onClick={actions.stop} style={{ marginLeft: 'auto', color: 'var(--dng)', padding: '.2rem .5rem' }}>&#x23f9;</button>
        </div>
      )}
      {!state.gen && state.stUp && (
        <div className="gb"><span className="gd">&#x25cf;</span> Auto-updating stats...</div>
      )}
      {state.story.trim() && !state.gen && !state.stUp && (
        <div className="ib">
          <span>{computed.wordCount.toLocaleString()}w</span>
          {state.mems.length > 0 && <span className="bd" style={{ background: 'var(--ac2)', color: '#fff' }}>Mem {state.mems.length}</span>}
          {state.secs.length > 0 && state.auFreq > 0 && <span className="bd" style={{ background: 'var(--bd)', color: 'var(--tx)' }}>auto:{state.auFreq}</span>}
        </div>
      )}

      {/* Error */}
      {state.err && <div className="er">{state.err}</div>}

      {/* Action input */}
      <ActionInput
        gen={state.gen}
        story={state.story}
        onSubmit={actions.submit}
        onContinue={actions.cont}
        onRegen={actions.regen}
        onDelete={actions.deleteLast}
        onStop={actions.stop}
        showArc={showArc}
        onToggleArc={() => setShowArc(a => !a)}
        arc={state.arc}
        onArcChange={v => setField('arc', v)}
        secsLength={state.secs.length}
        onShowTracking={() => setShowSt(true)}
      />
    </div>
  )
}
