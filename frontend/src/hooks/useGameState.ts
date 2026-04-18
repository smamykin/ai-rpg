import { useReducer, useCallback, useEffect, useRef, useState } from 'react'
import type { GameState, Memory, Section, Phase } from '../types'
import { defaultState, uid, wordCount } from '../types'
import * as api from '../api'

interface State extends GameState {
  phase: Phase
  gen: boolean
  streaming: string
  err: string
  summing: boolean
  stUp: boolean
  loaded: boolean
}

type Action =
  | { type: 'SET_FIELD'; field: keyof GameState; value: unknown }
  | { type: 'SET_PHASE'; phase: Phase }
  | { type: 'SET_GEN'; gen: boolean }
  | { type: 'SET_STREAMING'; text: string }
  | { type: 'SET_ERR'; err: string }
  | { type: 'SET_SUMMING'; summing: boolean }
  | { type: 'SET_STUP'; stUp: boolean }
  | { type: 'SET_STORY'; story: string }
  | { type: 'ADD_MEM'; mem: Memory }
  | { type: 'UPDATE_MEM'; id: string; text: string }
  | { type: 'REMOVE_MEM'; id: string }
  | { type: 'SET_MEMS'; mems: Memory[] }
  | { type: 'ADD_SEC'; sec: Section }
  | { type: 'UPDATE_SEC'; id: string; content: string }
  | { type: 'REMOVE_SEC'; id: string }
  | { type: 'SET_SECS'; secs: Section[] }
  | { type: 'LOAD_STATE'; state: GameState }
  | { type: 'RESET' }
  | { type: 'SET_LOADED' }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value }
    case 'SET_PHASE':
      return { ...state, phase: action.phase }
    case 'SET_GEN':
      return { ...state, gen: action.gen }
    case 'SET_STREAMING':
      return { ...state, streaming: action.text }
    case 'SET_ERR':
      return { ...state, err: action.err }
    case 'SET_SUMMING':
      return { ...state, summing: action.summing }
    case 'SET_STUP':
      return { ...state, stUp: action.stUp }
    case 'SET_STORY':
      return { ...state, story: action.story }
    case 'ADD_MEM':
      return { ...state, mems: [...state.mems, action.mem] }
    case 'UPDATE_MEM':
      return { ...state, mems: state.mems.map(m => m.id === action.id ? { ...m, text: action.text } : m) }
    case 'REMOVE_MEM':
      return { ...state, mems: state.mems.filter(m => m.id !== action.id) }
    case 'SET_MEMS':
      return { ...state, mems: action.mems }
    case 'ADD_SEC':
      return { ...state, secs: [...state.secs, action.sec] }
    case 'UPDATE_SEC':
      return { ...state, secs: state.secs.map(s => s.id === action.id ? { ...s, content: action.content } : s) }
    case 'REMOVE_SEC':
      return { ...state, secs: state.secs.filter(s => s.id !== action.id) }
    case 'SET_SECS':
      return { ...state, secs: action.secs }
    case 'LOAD_STATE':
      return {
        ...state,
        ...action.state,
        phase: action.state.story ? 'playing' : 'setup',
        loaded: true,
      }
    case 'RESET':
      return {
        ...defaultState(),
        phase: 'setup',
        gen: false,
        streaming: '',
        err: '',
        summing: false,
        stUp: false,
        loaded: true,
      }
    case 'SET_LOADED':
      return { ...state, loaded: true }
    default:
      return state
  }
}

const initialState: State = {
  ...defaultState(),
  phase: 'setup',
  gen: false,
  streaming: '',
  err: '',
  summing: false,
  stUp: false,
  loaded: false,
}

export function useGameState() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const abortRef = useRef<AbortController | null>(null)
  const beforeRef = useRef('')
  const genCountRef = useRef(0)
  const [pendingStatsUpdate, setPendingStatsUpdate] = useState(false)

  // Load state from server on mount
  useEffect(() => {
    api.getState()
      .then(s => dispatch({ type: 'LOAD_STATE', state: s }))
      .catch(() => dispatch({ type: 'SET_LOADED' }))
  }, [])

  // Auto-save to server (debounced)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    if (!state.loaded) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const { story, overview, style, cStyle, storyModel, supportModel, arc, diff, mems, addlMem, sumUpTo, secs, auFreq } = state
      api.saveState({ story, overview, style, cStyle, storyModel, supportModel, arc, diff, mems, addlMem, sumUpTo, secs, auFreq }).catch(() => {})
    }, 1000)
    return () => clearTimeout(saveTimer.current)
  }, [state.story, state.overview, state.style, state.cStyle, state.storyModel, state.supportModel, state.arc, state.diff, state.mems, state.addlMem, state.sumUpTo, state.secs, state.auFreq, state.loaded])

  // Trigger stats update after generation if needed (ref to avoid forward reference)
  const doUpdateStatsRef = useRef<() => void>(() => {})

  const setField = useCallback(<K extends keyof GameState>(field: K, value: GameState[K]) => {
    dispatch({ type: 'SET_FIELD', field, value })
  }, [])

  const generate = useCallback((task: string, action?: string, baseStory?: string) => {
    dispatch({ type: 'SET_GEN', gen: true })
    dispatch({ type: 'SET_ERR', err: '' })
    dispatch({ type: 'SET_STREAMING', text: '' })

    const base = baseStory ?? state.story
    beforeRef.current = base

    let currentStory = base
    if (task === 'action' && action) {
      currentStory = (base.trim() ? base.trim() + '\n\n' : '') + '> ' + action
      dispatch({ type: 'SET_STORY', story: currentStory })
    }

    const ctrl = new AbortController()
    abortRef.current = ctrl

    // Save state before generation so backend has latest story
    const savePromise = api.saveState({
      ...state,
      story: currentStory,
    }).catch(() => {})

    savePromise.then(() => {
      api.generate(task, action || '', ctrl.signal, {
        onChunk: (text) => {
          dispatch({ type: 'SET_STREAMING', text })
          dispatch({ type: 'SET_STORY', story: currentStory.trim() + '\n\n' + text })
        },
        onDone: (text) => {
          const finalStory = currentStory.trim() + (text.trim() ? '\n\n' + text.trim() : '')
          dispatch({ type: 'SET_STORY', story: finalStory })
          dispatch({ type: 'SET_STREAMING', text: '' })
          dispatch({ type: 'SET_GEN', gen: false })

          if (text.trim() && state.auFreq > 0 && state.secs.length > 0) {
            genCountRef.current++
            if (genCountRef.current >= state.auFreq) {
              genCountRef.current = 0
              setPendingStatsUpdate(true)
            }
          }
        },
        onError: (error) => {
          dispatch({ type: 'SET_ERR', err: error.slice(0, 300) })
          dispatch({ type: 'SET_STREAMING', text: '' })
          dispatch({ type: 'SET_GEN', gen: false })
        },
      })
    })
  }, [state])

  const start = useCallback(() => {
    dispatch({ type: 'SET_PHASE', phase: 'playing' })
    generate('open')
  }, [generate])

  const submit = useCallback((action: string) => {
    if (!action.trim() || state.gen) return
    generate('action', action.trim())
  }, [generate, state.gen])

  const cont = useCallback(() => {
    if (!state.gen) generate('continue')
  }, [generate, state.gen])

  const regen = useCallback(() => {
    if (state.gen || !state.story.trim()) return
    const base = beforeRef.current
    const chunks = (base || '').trim().split(/\n\n/)
    const last = chunks[chunks.length - 1] || ''

    if (last.startsWith('> ')) {
      dispatch({ type: 'SET_STORY', story: base })
      generate('action', last.replace(/^> /, ''), chunks.slice(0, -1).join('\n\n'))
    } else if (!base) {
      dispatch({ type: 'SET_STORY', story: '' })
      generate('open')
    } else {
      dispatch({ type: 'SET_STORY', story: base })
      generate('continue', undefined, base)
    }
  }, [generate, state.gen, state.story])

  const deleteLast = useCallback(() => {
    if (state.gen) return
    const chunks = state.story.trim().split(/\n\n/)
    if (!chunks.length) return
    chunks.pop()
    if (chunks.length && chunks[chunks.length - 1].startsWith('> ')) chunks.pop()
    dispatch({ type: 'SET_STORY', story: chunks.join('\n\n') })
  }, [state.gen, state.story])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    setTimeout(() => {
      dispatch({ type: 'SET_STREAMING', text: '' })
      dispatch({ type: 'SET_GEN', gen: false })
      dispatch({ type: 'SET_ERR', err: 'Stopped' })
    }, 500)
  }, [])

  const doSummarize = useCallback(async () => {
    const KR = 2000
    const canS = state.story.length > state.sumUpTo + KR + 500
    if (!canS || state.summing) return

    const textToSum = state.story.slice(state.sumUpTo, state.story.length - KR)
    dispatch({ type: 'SET_SUMMING', summing: true })
    dispatch({ type: 'SET_ERR', err: '' })

    try {
      const summary = await api.summarize(textToSum)
      if (summary.trim()) {
        dispatch({ type: 'ADD_MEM', mem: { id: uid(), text: summary.trim() } })
        dispatch({ type: 'SET_FIELD', field: 'sumUpTo', value: state.story.length - KR })
      }
    } catch (e) {
      dispatch({ type: 'SET_ERR', err: 'Summarization failed: ' + (e instanceof Error ? e.message : '') })
    }
    dispatch({ type: 'SET_SUMMING', summing: false })
  }, [state.story, state.sumUpTo, state.summing])

  const doUpdateStats = useCallback(async () => {
    if (!state.secs.length || state.stUp) return
    dispatch({ type: 'SET_STUP', stUp: true })
    dispatch({ type: 'SET_ERR', err: '' })

    try {
      const updated = await api.updateStats(state.secs, state.story)
      dispatch({ type: 'SET_SECS', secs: updated })
    } catch (e) {
      dispatch({ type: 'SET_ERR', err: 'Stats update failed: ' + (e instanceof Error ? e.message : '') })
    }
    dispatch({ type: 'SET_STUP', stUp: false })
  }, [state.secs, state.story, state.stUp])

  // Keep ref in sync and trigger deferred stats update
  doUpdateStatsRef.current = doUpdateStats
  useEffect(() => {
    if (!state.gen && pendingStatsUpdate && state.secs.length > 0) {
      setPendingStatsUpdate(false)
      doUpdateStatsRef.current()
    }
  }, [state.gen, pendingStatsUpdate, state.secs.length])

  const newAdventure = useCallback(async () => {
    try {
      await api.deleteState()
    } catch { /* ignore */ }
    genCountRef.current = 0
    dispatch({ type: 'RESET' })
  }, [])

  const saveFile = useCallback(async () => {
    try {
      const blob = await api.exportState()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'adventure.json'
      a.click()
    } catch { /* ignore */ }
  }, [])

  const exportMd = useCallback(() => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([`# ${state.overview || 'Adventure'}\n\n${state.story}`], { type: 'text/markdown' }))
    a.download = 'adventure.md'
    a.click()
  }, [state.overview, state.story])

  const loadFile = useCallback(() => {
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.accept = '.json'
    inp.onchange = async (e) => {
      try {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return
        const text = await file.text()
        const imported = await api.importState(text)
        dispatch({ type: 'LOAD_STATE', state: imported })
      } catch {
        dispatch({ type: 'SET_ERR', err: 'Failed to load' })
      }
    }
    inp.click()
  }, [])

  // Computed values
  const wt = wordCount(state.story)
  const KR = 2000
  const canSummarize = state.story.length > state.sumUpTo + KR + 500
  const textToSummarize = canSummarize ? state.story.slice(state.sumUpTo, state.story.length - KR) : ''
  const summarizeWordCount = wordCount(textToSummarize)

  return {
    state,
    dispatch,
    setField,
    actions: {
      start,
      submit,
      cont,
      regen,
      deleteLast,
      stop,
      doSummarize,
      doUpdateStats,
      newAdventure,
      saveFile,
      exportMd,
      loadFile,
      generate,
    },
    computed: {
      wordCount: wt,
      canSummarize,
      summarizeWordCount,
    },
  }
}
