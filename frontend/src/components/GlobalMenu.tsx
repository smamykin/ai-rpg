import { useState } from 'react'
import SettingsPanel from './panels/SettingsPanel'
import { useDisplayPrefs } from '../hooks/useDisplayPrefs'
import { useTTS } from '../hooks/useTTS'
import type { GameState } from '../types'

interface Props {
  state: GameState
  dispatch: React.Dispatch<any>
  setField: <K extends keyof GameState>(field: K, value: GameState[K]) => void
}

export default function GlobalMenu({ state, dispatch, setField }: Props) {
  const [show, setShow] = useState(false)
  const dp = useDisplayPrefs()
  const tts = useTTS()

  return (
    <>
      <button
        className={`b bs${show ? ' ba' : ''}`}
        onClick={() => setShow(s => !s)}
        title="Settings"
        aria-label="Settings"
      >&#x2630;</button>
      <SettingsPanel
        show={show}
        onClose={() => setShow(false)}
        visibleTabs={['settings']}
        storyModel={state.storyModel}
        supportModel={state.supportModel}
        modelRoles={state.modelRoles}
        effectiveCtxTokens={state.effectiveCtxTokens}
        setField={setField}
        tts={state.tts}
        dispatch={dispatch}
        ttsPlaying={tts.isPlaying || tts.isLoading}
        onStopTTS={tts.stop}
        displayPrefs={dp.prefs}
        onSetTheme={dp.setTheme}
        onSetFontFamily={dp.setFontFamily}
        onSetFontSize={dp.setFontSize}
        onSetEditorFontFamily={dp.setEditorFontFamily}
        onSetEditorFontSize={dp.setEditorFontSize}
      />
    </>
  )
}
