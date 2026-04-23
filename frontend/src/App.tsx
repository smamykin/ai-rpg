import { useCallback, useState } from 'react'
import { useGameState } from './hooks/useGameState'
import { useSessions } from './hooks/useSessions'
import type { GameState } from './types'
import Setup from './components/Setup'
import Playing from './components/Playing'
import Hub from './components/Hub'
import ScenarioEditor from './components/ScenarioEditor'

function App() {
  const { state, dispatch, setField, actions, computed } = useGameState()
  const [editingScenarioId, setEditingScenarioId] = useState<string | null>(null)
  const [scenariosVersion, setScenariosVersion] = useState(0)

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

  if (!state.loaded) {
    return (
      <div className="R">
        <div className="load-splash">Loading&hellip;</div>
      </div>
    )
  }

  if (state.phase === 'scenarioEditor') {
    return (
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
    )
  }

  if (state.phase === 'hub') {
    return (
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
        state={state}
        dispatch={dispatch}
        setField={setField}
      />
    )
  }

  if (state.phase === 'setup') {
    return (
      <Setup
        state={state}
        dispatch={dispatch}
        setField={setField}
        onStart={actions.start}
        onBack={actions.enterHub}
      />
    )
  }

  return (
    <Playing
      state={state}
      dispatch={dispatch}
      setField={setField}
      actions={actions}
      computed={computed}
    />
  )
}

export default App
