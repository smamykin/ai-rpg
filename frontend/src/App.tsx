import { useCallback, useEffect, useState } from 'react'
import { useGameState } from './hooks/useGameState'
import { useSessions } from './hooks/useSessions'
import type { GameState } from './types'
import * as api from './api'
import Setup from './components/Setup'
import Playing from './components/Playing'
import Hub from './components/Hub'
import ScenarioEditor from './components/ScenarioEditor'
import SchemaWipeModal from './components/SchemaWipeModal'

function App() {
  const { state, dispatch, setField, actions, computed } = useGameState()
  const [editingScenarioId, setEditingScenarioId] = useState<string | null>(null)
  const [scenariosVersion, setScenariosVersion] = useState(0)
  const [schemaWipe, setSchemaWipe] = useState<api.SchemaWipeRequiredError | null>(null)

  useEffect(() => {
    api.setSchemaWipeRequiredHandler(err => setSchemaWipe(err))
    return () => api.setSchemaWipeRequiredHandler(null)
  }, [])

  const onLoaded = useCallback((s: GameState) => {
    dispatch({ type: 'LOAD_STATE', state: s })
  }, [dispatch])

  const onEnterHub = useCallback(() => {
    dispatch({ type: 'ENTER_HUB' })
  }, [dispatch])

  const sessions = useSessions({
    flushPendingSave: actions.flushPendingSave,
    abortGeneration: actions.abortGeneration,
    onLoaded,
    onEnterHub,
  })

  const wipeModal = (
    <SchemaWipeModal
      show={!!schemaWipe}
      storedMajor={schemaWipe?.storedMajor ?? 0}
      storedMinor={schemaWipe?.storedMinor ?? 0}
      currentMajor={schemaWipe?.currentMajor ?? 0}
      currentMinor={schemaWipe?.currentMinor ?? 0}
    />
  )

  if (!state.loaded) {
    return (
      <>
        <div className="R">
          <div className="load-splash">Loading&hellip;</div>
        </div>
        {wipeModal}
      </>
    )
  }

  if (state.phase === 'scenarioEditor') {
    return (
      <>
        <ScenarioEditor
          scenarioId={editingScenarioId}
          onSaved={() => {
            setEditingScenarioId(null)
            setScenariosVersion(v => v + 1)
            dispatch({ type: 'ENTER_HUB' })
          }}
          onDeleted={() => {
            setEditingScenarioId(null)
            setScenariosVersion(v => v + 1)
            dispatch({ type: 'ENTER_HUB' })
          }}
          onCancel={() => {
            setEditingScenarioId(null)
            dispatch({ type: 'ENTER_HUB' })
          }}
        />
        {wipeModal}
      </>
    )
  }

  if (state.phase === 'hub') {
    return (
      <>
        <Hub
          sessions={sessions.sessions}
          current={sessions.current}
          busy={sessions.busy}
          onSwitch={sessions.switchTo}
          onCreate={sessions.create}
          onRename={sessions.rename}
          onDelete={sessions.remove}
          scenariosVersion={scenariosVersion}
          onEditScenario={(id) => {
            setEditingScenarioId(id)
            dispatch({ type: 'SET_PHASE', phase: 'scenarioEditor' })
          }}
          onNewScenario={() => {
            setEditingScenarioId(null)
            dispatch({ type: 'SET_PHASE', phase: 'scenarioEditor' })
          }}
        />
        {wipeModal}
      </>
    )
  }

  if (state.phase === 'setup') {
    return (
      <>
        <Setup
          state={state}
          setField={setField}
          onStart={actions.start}
          onBack={actions.enterHub}
        />
        {wipeModal}
      </>
    )
  }

  return (
    <>
      <Playing
        state={state}
        dispatch={dispatch}
        setField={setField}
        actions={actions}
        computed={computed}
      />
      {wipeModal}
    </>
  )
}

export default App
