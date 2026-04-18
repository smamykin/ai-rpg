import { useGameState } from './hooks/useGameState'
import Setup from './components/Setup'
import Playing from './components/Playing'

function App() {
  const { state, dispatch, setField, actions, computed } = useGameState()

  if (!state.loaded) {
    return (
      <div className="R">
        <div className="load-splash">Loading&hellip;</div>
      </div>
    )
  }

  if (state.phase === 'setup') {
    return (
      <Setup
        state={state}
        setField={setField}
        onStart={actions.start}
        onLoad={actions.loadFile}
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
