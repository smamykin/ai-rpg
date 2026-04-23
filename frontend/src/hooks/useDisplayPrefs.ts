import { useState, useCallback } from 'react'
import { THEMES, DISPLAY_DEFAULTS, FONT_SIZE_MIN, FONT_SIZE_MAX } from '../display'
import type { DisplayPrefs } from '../display'

const LS_KEY = 'ai-rpg-display'
const loadedFonts = new Set<string>(['Crimson Pro'])

function applyTheme(id: string) {
  const theme = THEMES.find(t => t.id === id) || THEMES[0]
  const root = document.documentElement.style
  for (const [k, v] of Object.entries(theme.vars)) {
    root.setProperty(k, v)
  }
}

function applyStoryFont(family: string, size: number) {
  const root = document.documentElement.style
  root.setProperty('--story-font', `'${family}'`)
  root.setProperty('--story-size', `${size}rem`)
}

function applyEditorFont(family: string, size: number) {
  const root = document.documentElement.style
  root.setProperty('--editor-font', `'${family}'`)
  root.setProperty('--editor-size', `${size}rem`)
}

function loadFont(name: string) {
  if (loadedFonts.has(name)) return
  loadedFonts.add(name)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name)}:ital,wght@0,400;0,600;1,400&display=swap`
  document.head.appendChild(link)
}

function load(): DisplayPrefs {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const prefs = { ...DISPLAY_DEFAULTS, ...parsed }
      applyTheme(prefs.theme)
      applyStoryFont(prefs.fontFamily, prefs.fontSize)
      applyEditorFont(prefs.editorFontFamily, prefs.editorFontSize)
      loadFont(prefs.fontFamily)
      loadFont(prefs.editorFontFamily)
      return prefs
    }
  } catch { /* ignore */ }
  return DISPLAY_DEFAULTS
}

function persist(prefs: DisplayPrefs) {
  localStorage.setItem(LS_KEY, JSON.stringify(prefs))
}

export function useDisplayPrefs() {
  const [prefs, setPrefs] = useState<DisplayPrefs>(load)

  const setTheme = useCallback((id: string) => {
    setPrefs(prev => {
      const next = { ...prev, theme: id }
      applyTheme(id)
      persist(next)
      return next
    })
  }, [])

  const setFontFamily = useCallback((name: string) => {
    loadFont(name)
    setPrefs(prev => {
      const next = { ...prev, fontFamily: name }
      applyStoryFont(name, prev.fontSize)
      persist(next)
      return next
    })
  }, [])

  const setFontSize = useCallback((size: number) => {
    const clamped = Number(Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, size)).toFixed(1))
    setPrefs(prev => {
      const next = { ...prev, fontSize: clamped }
      applyStoryFont(prev.fontFamily, clamped)
      persist(next)
      return next
    })
  }, [])

  const setEditorFontFamily = useCallback((name: string) => {
    loadFont(name)
    setPrefs(prev => {
      const next = { ...prev, editorFontFamily: name }
      applyEditorFont(name, prev.editorFontSize)
      persist(next)
      return next
    })
  }, [])

  const setEditorFontSize = useCallback((size: number) => {
    const clamped = Number(Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, size)).toFixed(1))
    setPrefs(prev => {
      const next = { ...prev, editorFontSize: clamped }
      applyEditorFont(prev.editorFontFamily, clamped)
      persist(next)
      return next
    })
  }, [])

  return { prefs, setTheme, setFontFamily, setFontSize, setEditorFontFamily, setEditorFontSize }
}
