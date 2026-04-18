import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from '../api'

export interface TTSPlayRequest {
  text: string
  model: string
  voice: string
  speed?: number
  instructions?: string
  dialogueVoice?: string
}

interface QueuedTrack {
  text: string
  model: string
  voice: string
  speed?: number
  instructions?: string
}

export interface UseTTSHandle {
  playReplace: (req: TTSPlayRequest) => void
  playAppend: (req: TTSPlayRequest) => void
  stop: () => void
  isPlaying: boolean
  isLoading: boolean
  error: string
}

// Split text into segments by quoted dialogue. Handles both straight and smart quotes.
// Returns ordered list of { text, isDialogue } covering the whole input.
function splitByDialogue(text: string): { text: string; isDialogue: boolean }[] {
  const re = /["\u201c]([^"\u201c\u201d]+?)["\u201d]/g
  const out: { text: string; isDialogue: boolean }[] = []
  let lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > lastIndex) {
      const chunk = text.slice(lastIndex, m.index).trim()
      if (chunk) out.push({ text: chunk, isDialogue: false })
    }
    const inner = m[1].trim()
    if (inner) out.push({ text: inner, isDialogue: true })
    lastIndex = m.index + m[0].length
  }
  if (lastIndex < text.length) {
    const tail = text.slice(lastIndex).trim()
    if (tail) out.push({ text: tail, isDialogue: false })
  }
  if (!out.length) out.push({ text, isDialogue: false })
  return out
}

function expandToTracks(req: TTSPlayRequest): QueuedTrack[] {
  const base: Omit<QueuedTrack, 'text' | 'voice'> = {
    model: req.model,
    speed: req.speed,
    instructions: req.instructions,
  }
  if (req.dialogueVoice && req.dialogueVoice.trim()) {
    const segments = splitByDialogue(req.text)
    return segments.map(s => ({
      ...base,
      text: s.text,
      voice: s.isDialogue ? req.dialogueVoice! : req.voice,
    }))
  }
  return [{ ...base, text: req.text, voice: req.voice }]
}

export function useTTS(): UseTTSHandle {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const queueRef = useRef<QueuedTrack[]>([])
  const currentUrlRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Create single audio element on mount
  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio
    const onEnded = () => {
      if (currentUrlRef.current) {
        URL.revokeObjectURL(currentUrlRef.current)
        currentUrlRef.current = null
      }
      setIsPlaying(false)
      playNext()
    }
    const onError = () => {
      setIsPlaying(false)
      setError('Playback failed')
    }
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    return () => {
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      audio.pause()
      if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const playNext = useCallback(() => {
    const track = queueRef.current.shift()
    if (!track) return
    const audio = audioRef.current
    if (!audio) return

    setIsLoading(true)
    setError('')
    const ctrl = new AbortController()
    abortRef.current = ctrl

    api.tts({
      text: track.text,
      model: track.model,
      voice: track.voice,
      speed: track.speed,
      instructions: track.instructions,
    }, ctrl.signal)
      .then(blob => {
        if (ctrl.signal.aborted) return
        const url = URL.createObjectURL(blob)
        currentUrlRef.current = url
        audio.src = url
        audio.play().then(() => {
          setIsPlaying(true)
          setIsLoading(false)
        }).catch(err => {
          setIsPlaying(false)
          setIsLoading(false)
          setError('Playback blocked: ' + err.message)
        })
      })
      .catch(err => {
        if ((err as Error).name === 'AbortError') return
        setIsLoading(false)
        setError((err as Error).message || 'TTS failed')
        // Try the next track if the current fetch failed
        playNext()
      })
  }, [])

  const clearQueueAndStop = useCallback(() => {
    queueRef.current = []
    abortRef.current?.abort()
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.src = ''
    }
    if (currentUrlRef.current) {
      URL.revokeObjectURL(currentUrlRef.current)
      currentUrlRef.current = null
    }
    setIsPlaying(false)
    setIsLoading(false)
  }, [])

  const playReplace = useCallback((req: TTSPlayRequest) => {
    if (!req.text || !req.text.trim()) return
    clearQueueAndStop()
    queueRef.current = expandToTracks(req)
    playNext()
  }, [clearQueueAndStop, playNext])

  const playAppend = useCallback((req: TTSPlayRequest) => {
    if (!req.text || !req.text.trim()) return
    const tracks = expandToTracks(req)
    queueRef.current.push(...tracks)
    const audio = audioRef.current
    // Start playback if nothing is currently playing or loading
    if (audio && audio.paused && !currentUrlRef.current && !abortRef.current) {
      playNext()
    } else if (!isPlaying && !isLoading) {
      playNext()
    }
  }, [playNext, isPlaying, isLoading])

  const stop = useCallback(() => {
    clearQueueAndStop()
    setError('')
  }, [clearQueueAndStop])

  return { playReplace, playAppend, stop, isPlaying, isLoading, error }
}
