import { useCallback, useEffect, useState } from 'react'
import type { SessionMeta, GameState } from '../types'
import * as api from '../api'
import { readGlobalSettings, GLOBAL_DEFAULTS } from './useGlobalSettings'

function applyDefaults(st: GameState): GameState {
  const defs = readGlobalSettings()
  return {
    ...st,
    storyModel: st.storyModel || defs.storyModel,
    supportModel: st.supportModel || defs.supportModel,
    modelRoles: Object.keys(st.modelRoles || {}).length ? st.modelRoles : defs.modelRoles,
    reasoningEffort: st.reasoningEffort || defs.reasoningEffort,
    effectiveCtxTokens: st.effectiveCtxTokens && st.effectiveCtxTokens !== GLOBAL_DEFAULTS.effectiveCtxTokens
      ? st.effectiveCtxTokens
      : defs.effectiveCtxTokens,
    tokenCaps: { ...defs.tokenCaps, ...(st.tokenCaps || {}) },
    tts: hasCustomTTS(st.tts) ? st.tts : defs.tts,
  }
}

function hasCustomTTS(tts: GameState['tts'] | undefined): boolean {
  if (!tts) return false
  if (tts.autoPlay) return true
  if (tts.activeModel && tts.activeModel !== GLOBAL_DEFAULTS.tts.activeModel) return true
  if (tts.perModel && Object.keys(tts.perModel).length > 0) return true
  return false
}

interface UseSessionsHelpers {
  flushPendingSave: () => Promise<void>
  abortGeneration: () => void
  onLoaded: (state: GameState) => void
  onEnterHub: () => void
}

export function useSessions(helpers: UseSessionsHelpers) {
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [current, setCurrent] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const refresh = useCallback(async () => {
    try {
      const res = await api.listSessions()
      setSessions(res.sessions)
      setCurrent(res.current || '')
    } catch (e) {
      setErr((e as Error).message)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const create = useCallback(async (name: string, scenarioId?: string) => {
    setBusy(true); setErr('')
    try {
      await helpers.flushPendingSave()
      helpers.abortGeneration()
      const raw = await api.createSession(name, scenarioId)
      const st = applyDefaults(raw)
      api.setCurrentSessionId(st.sessionId)
      helpers.onLoaded(st)
      await refresh()
      return st
    } catch (e) {
      setErr((e as Error).message)
      throw e
    } finally {
      setBusy(false)
    }
  }, [helpers, refresh])

  const rename = useCallback(async (id: string, name: string) => {
    await api.renameSession(id, name)
    await refresh()
  }, [refresh])

  const remove = useCallback(async (id: string) => {
    await api.deleteSession(id)
    await refresh()
  }, [refresh])

  const switchTo = useCallback(async (id: string) => {
    setBusy(true); setErr('')
    try {
      await helpers.flushPendingSave()
      helpers.abortGeneration()
      const st = await api.switchSession(id)
      api.setCurrentSessionId(st.sessionId)
      helpers.onLoaded(st)
      await refresh()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }, [helpers, refresh])

  const enterHub = useCallback(() => {
    api.setCurrentSessionId('')
    helpers.onEnterHub()
    refresh()
  }, [helpers, refresh])

  return { sessions, current, busy, err, refresh, create, rename, remove, switchTo, enterHub }
}
