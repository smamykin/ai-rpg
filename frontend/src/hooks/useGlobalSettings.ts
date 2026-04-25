import { useCallback, useState } from 'react'
import type { TTSSettings, TTSModelSettings } from '../types'

const LS_KEY = 'ai-rpg-defaults'

export interface GlobalSettings {
  storyModel: string
  supportModel: string
  modelRoles: Record<string, string>
  reasoningEffort: string
  effectiveCtxTokens: number
  tts: TTSSettings
}

export const GLOBAL_DEFAULTS: GlobalSettings = {
  storyModel: '',
  supportModel: '',
  modelRoles: {},
  reasoningEffort: '',
  effectiveCtxTokens: 32000,
  tts: { autoPlay: false, activeModel: 'Kokoro-82m', perModel: {} },
}

export function readGlobalSettings(): GlobalSettings {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        ...GLOBAL_DEFAULTS,
        ...parsed,
        modelRoles: { ...GLOBAL_DEFAULTS.modelRoles, ...(parsed.modelRoles || {}) },
        tts: { ...GLOBAL_DEFAULTS.tts, ...(parsed.tts || {}) },
      }
    }
  } catch { /* ignore */ }
  return { ...GLOBAL_DEFAULTS }
}

export function writeGlobalSettings(s: GlobalSettings): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s))
  } catch { /* ignore */ }
}

type TTSAction =
  | { type: 'SET_TTS_AUTOPLAY'; autoPlay: boolean }
  | { type: 'SET_TTS_MODEL'; model: string }
  | { type: 'SET_TTS_MODEL_SETTING'; model: string; settings: Partial<TTSModelSettings> }

export function useGlobalSettings() {
  const [settings, setSettings] = useState<GlobalSettings>(readGlobalSettings)

  const setField = useCallback(<K extends keyof GlobalSettings>(field: K, value: GlobalSettings[K]) => {
    setSettings(prev => {
      const next = { ...prev, [field]: value }
      writeGlobalSettings(next)
      return next
    })
  }, [])

  const dispatch = useCallback((action: TTSAction) => {
    setSettings(prev => {
      let next = prev
      switch (action.type) {
        case 'SET_TTS_AUTOPLAY':
          next = { ...prev, tts: { ...prev.tts, autoPlay: action.autoPlay } }
          break
        case 'SET_TTS_MODEL':
          next = { ...prev, tts: { ...prev.tts, activeModel: action.model } }
          break
        case 'SET_TTS_MODEL_SETTING': {
          const perModel = { ...(prev.tts.perModel || {}) }
          perModel[action.model] = { ...(perModel[action.model] || {}), ...action.settings }
          next = { ...prev, tts: { ...prev.tts, perModel } }
          break
        }
      }
      writeGlobalSettings(next)
      return next
    })
  }, [])

  return { settings, setField, dispatch }
}
