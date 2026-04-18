import { useState, useCallback } from 'react'
import type { GalleryImage } from '../types'

const STORAGE_KEY_V1 = 'ai-rpg-gallery'
const STORAGE_KEY = 'ai-rpg-gallery-v2'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function load(): GalleryImage[] {
  // v2 path
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const imgs: GalleryImage[] = JSON.parse(raw)
      const cutoff = Date.now() - MAX_AGE_MS
      return imgs.filter(i => i.createdAt > cutoff)
    }
  } catch {
    // fall through to v1 migration
  }

  // v1 → v2 migration: mark legacy images as "unassigned" (sessionId: null).
  try {
    const raw = localStorage.getItem(STORAGE_KEY_V1)
    if (!raw) return []
    const imgs: GalleryImage[] = JSON.parse(raw)
    const cutoff = Date.now() - MAX_AGE_MS
    const migrated = imgs
      .filter(i => i.createdAt > cutoff)
      .map(i => ({ ...i, sessionId: null }))
    persist(migrated)
    return migrated
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

  return { images, addImages, removeImage, clearAll, getForLore, count: images.length }
}
