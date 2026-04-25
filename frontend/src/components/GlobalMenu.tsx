import { useState } from 'react'
import { Menu } from 'lucide-react'
import SettingsPanel from './panels/SettingsPanel'
import { useDisplayPrefs } from '../hooks/useDisplayPrefs'
import { useGlobalSettings } from '../hooks/useGlobalSettings'

export default function GlobalMenu() {
  const [show, setShow] = useState(false)
  const dp = useDisplayPrefs()
  const gs = useGlobalSettings()

  return (
    <>
      <button
        className={`b bs${show ? ' ba' : ''}`}
        onClick={() => setShow(s => !s)}
        title="Settings"
        aria-label="Settings"
      ><Menu size={16} className="ic" /></button>
      <SettingsPanel
        show={show}
        onClose={() => setShow(false)}
        visibleTabs={['settings']}
        scope="global"
        storyModel={gs.settings.storyModel}
        supportModel={gs.settings.supportModel}
        reasoningEffort={gs.settings.reasoningEffort}
        modelRoles={gs.settings.modelRoles}
        effectiveCtxTokens={gs.settings.effectiveCtxTokens}
        setField={gs.setField}
        tts={gs.settings.tts}
        dispatch={gs.dispatch}
        ttsPlaying={false}
        onStopTTS={() => {}}
        displayPrefs={dp.prefs}
        onSetTheme={dp.setTheme}
        onSetFontFamily={dp.setFontFamily}
        onSetFontSize={dp.setFontSize}
        onSetEditorFontFamily={dp.setEditorFontFamily}
        onSetEditorFontSize={dp.setEditorFontSize}
        onSetAmbientBg={dp.setAmbientBg}
        onSetAmbientBlur={dp.setAmbientBlur}
      />
    </>
  )
}
