import { useState, useCallback } from 'react'
import type { GalleryImage } from '../types'

const STORAGE_KEY = 'ai-rpg-gallery-v2'
const BG_KEY = 'ai-rpg-bg'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function loadBgMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(BG_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function persistBgMap(m: Record<string, string>) {
  try { localStorage.setItem(BG_KEY, JSON.stringify(m)) } catch { /* ignore */ }
}

function load(): GalleryImage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const imgs: GalleryImage[] = JSON.parse(raw)
    const cutoff = Date.now() - MAX_AGE_MS
    return imgs.filter(i => i.createdAt > cutoff)
  } catch {
    return []
  }
}

function persist(imgs: GalleryImage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(imgs))
  } catch {
    // localStorage full — silently fail
  }
}

export function useGallery() {
  const [images, setImages] = useState<GalleryImage[]>(load)
  const [bgMap, setBgMap] = useState<Record<string, string>>(loadBgMap)

  const setBgImageId = useCallback((sessionId: string, id: string | null) => {
    setBgMap(prev => {
      const next = { ...prev }
      if (id) next[sessionId] = id
      else delete next[sessionId]
      persistBgMap(next)
      return next
    })
  }, [])

  const getBgImageId = useCallback(
    (sessionId: string) => bgMap[sessionId],
    [bgMap]
  )

  const addImages = useCallback((newImgs: GalleryImage[], sessionId?: string) => {
    const stamped = sessionId
      ? newImgs.map(i => (i.sessionId ? i : { ...i, sessionId }))
      : newImgs
    setImages(prev => {
      const next = [...stamped, ...prev]
      persist(next)
      return next
    })
  }, [])

  const removeImage = useCallback((id: string) => {
    setImages(prev => {
      const next = prev.filter(i => i.id !== id)
      persist(next)
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    setImages([])
    persist([])
  }, [])

  const getForLore = useCallback(
    (loreEntryId: string) => images.find(i => i.loreEntryId === loreEntryId),
    [images]
  )

  return { images, addImages, removeImage, clearAll, getForLore, setBgImageId, getBgImageId, count: images.length }
}
