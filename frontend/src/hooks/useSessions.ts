import { useCallback, useEffect, useState } from 'react'
import type { SessionMeta, GameState } from '../types'
import * as api from '../api'

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
      const st = await api.createSession(name, scenarioId)
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
