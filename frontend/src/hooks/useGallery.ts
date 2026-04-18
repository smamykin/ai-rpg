import { useState, useCallback } from 'react'
import type { GalleryImage } from '../types'

const STORAGE_KEY = 'ai-rpg-gallery'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

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

  const addImages = useCallback((newImgs: GalleryImage[]) => {
    setImages(prev => {
      const next = [...newImgs, ...prev]
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
