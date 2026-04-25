import { useState, useEffect, useCallback } from 'react'
import type { ModelInfo } from '../types'
import * as api from '../api'

const STORAGE_KEY = 'ai-rpg-models'

let cache: ModelInfo[] | null = null
let inflight: Promise<ModelInfo[]> | null = null
const subscribers = new Set<(list: ModelInfo[]) => void>()

function readStorage(): ModelInfo[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as ModelInfo[]
  } catch {
    // ignore
  }
  return null
}

function writeStorage(list: ModelInfo[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
}

function broadcast(list: ModelInfo[]) {
  cache = list
  writeStorage(list)
  for (const fn of subscribers) fn(list)
}

async function fetchOnce(): Promise<ModelInfo[]> {
  if (inflight) return inflight
  inflight = api.getModels()
    .then(list => {
      broadcast(list)
      return list
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

export function useModels() {
  const initial = cache ?? readStorage() ?? []
  if (cache === null && initial.length > 0) cache = initial
  const [models, setModels] = useState<ModelInfo[]>(initial)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const sub = (list: ModelInfo[]) => setModels(list)
    subscribers.add(sub)
    return () => { subscribers.delete(sub) }
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      await fetchOnce()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load models')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (cache === null && !inflight) {
      reload()
    }
  }, [reload])

  return { models, loading, error, reload }
}
