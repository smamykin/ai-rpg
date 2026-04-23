import { useState, useEffect, useRef } from 'react'
import type { GalleryImage, ImageModelInfo, LoreEntry } from '../types'
import { DIMENSION_PRESETS, uid } from '../types'
import * as api from '../api'
import ExpandableTextarea from './ExpandableTextarea'

interface GameContext {
  story: string             // active chapter content
  summaries: string         // joined chapter summaries
  lore: LoreEntry[]
  overview: string
  imgStyle?: string
}

interface Props {
  open: boolean
  onClose: () => void
  onImagesGenerated: (images: GalleryImage[]) => void
  gameState: GameContext
  defaultSource: 'story' | 'lore'
  defaultLoreEntryId?: string
}

const MODEL_STORAGE_KEY = 'ai-rpg-img-models'
const SELECTED_MODEL_KEY = 'ai-rpg-img-model'

function loadCachedModels(): ImageModelInfo[] {
  try {
    const raw = localStorage.getItem(MODEL_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export default function GenerateImageModal({
  open,
  onClose,
  onImagesGenerated,
  gameState,
  defaultSource,
  defaultLoreEntryId,
}: Props) {
  const [mode, setMode] = useState<'manual' | 'ai'>('ai')
  const [prompt, setPrompt] = useState('')
  const [instructions, setInstructions] = useState('')

  // Context toggles
  const [ctxStory, setCtxStory] = useState(true)
  const [ctxSummaries, setCtxSummaries] = useState(true)
  const [ctxLore, setCtxLore] = useState(false)
  const [ctxOverview, setCtxOverview] = useState(true)

  // Image settings
  const [imageModels, setImageModels] = useState<ImageModelInfo[]>(loadCachedModels)
  const [modelSearch, setModelSearch] = useState(() => localStorage.getItem(SELECTED_MODEL_KEY) || '')
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem(SELECTED_MODEL_KEY) || '')
  const [imgW, setImgW] = useState(1024)
  const [imgH, setImgH] = useState(1024)
  const [numImages, setNumImages] = useState(1)

  // State
  const [generating, setGenerating] = useState(false)
  const [enhancing, setEnhancing] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)
  const [error, setError] = useState('')

  // Dropdown
  const [showDD, setShowDD] = useState(false)
  const ddRef = useRef<HTMLDivElement>(null)

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setError('')
      setCtxLore(defaultSource === 'lore')
    }
  }, [open, defaultSource])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ddRef.current && !ddRef.current.contains(e.target as Node)) setShowDD(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!open) return null

  const activePreset = DIMENSION_PRESETS.find(p => p.w === imgW && p.h === imgH)?.label || null

  const loadModels = async () => {
    setLoadingModels(true)
    setError('')
    try {
      const models = await api.getImageModels()
      setImageModels(models)
      localStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify(models))
    } catch (e: any) {
      setError(e.message || 'Failed to load models')
    } finally {
      setLoadingModels(false)
    }
  }

  const selectModel = (id: string) => {
    setSelectedModel(id)
    setModelSearch(id)
    localStorage.setItem(SELECTED_MODEL_KEY, id)
    setShowDD(false)
  }

  const filteredModels = imageModels.filter(m =>
    m.id.toLowerCase().includes(modelSearch.toLowerCase())
  ).slice(0, 80)

  const buildContext = () => {
    const ctx: Parameters<typeof api.enhanceImagePrompt>[1] = {}
    if (gameState.imgStyle && gameState.imgStyle.trim()) ctx.imageStyle = gameState.imgStyle.trim()
    if (ctxOverview && gameState.overview) ctx.overview = gameState.overview
    if (ctxSummaries && gameState.summaries) {
      ctx.summaries = gameState.summaries
    }
    if (ctxStory && gameState.story) {
      const recent = gameState.story.slice(-2000)
      ctx.recentStory = recent
    }
    if (ctxLore) {
      const entries = defaultLoreEntryId
        ? gameState.lore.filter(l => l.id === defaultLoreEntryId)
        : gameState.lore.filter(l => l.enabled)
      if (entries.length > 0) {
        ctx.loreEntries = entries.map(l => ({ name: l.name, text: l.text }))
      }
    }
    return ctx
  }

  const enhancePrompt = async () => {
    if (!instructions.trim()) return
    setEnhancing(true)
    setError('')
    try {
      const result = await api.enhanceImagePrompt(instructions.trim(), buildContext())
      setPrompt(result)
      setMode('manual')
    } catch (e: any) {
      setError(e.message || 'Failed to enhance prompt')
    } finally {
      setEnhancing(false)
    }
  }

  const generate = async () => {
    if (!prompt.trim() || !selectedModel) return
    setGenerating(true)
    setError('')
    try {
      const results = await api.generateImages(selectedModel, prompt.trim(), numImages, imgW, imgH)
      const newImages: GalleryImage[] = results.map(r => ({
        id: uid(),
        url: r.url,
        prompt: prompt.trim(),
        model: selectedModel,
        width: imgW,
        height: imgH,
        createdAt: Date.now(),
        source: defaultSource,
        loreEntryId: defaultLoreEntryId,
      }))
      onImagesGenerated(newImages)
      onClose()
    } catch (e: any) {
      setError(e.message || 'Failed to generate image')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="gm-ov" onClick={onClose}>
      <div className="gm" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="ph">
          <span style={{ fontWeight: 600, fontSize: '.95rem' }}>Generate Image</span>
          <button className="b bs" onClick={onClose}>&times;</button>
        </div>

        {/* Mode toggle */}
        <div className="gm-tabs">
          <button className={`b bs${mode === 'ai' ? ' ba' : ''}`} onClick={() => setMode('ai')}>
            AI Assist
          </button>
          <button className={`b bs${mode === 'manual' ? ' ba' : ''}`} onClick={() => setMode('manual')}>
            Manual
          </button>
        </div>

        {/* AI Assist mode */}
        {mode === 'ai' && (
          <>
            <div className="gr">
              <label className="lb">Instructions</label>
              <ExpandableTextarea
                className="mt"
                value={instructions}
                onChange={v => setInstructions(v)}
                placeholder="Describe what you want the image to show..."
                rows={3}
                title="Image AI instructions"
              />
            </div>

            {gameState.imgStyle && gameState.imgStyle.trim() && (
              <div className="hint" style={{ marginBottom: '.4rem' }}>
                <strong style={{ color: 'var(--ac)' }}>Image style:</strong> {gameState.imgStyle.trim()}
              </div>
            )}

            <div className="gm-ctx">
              <label className="lb" style={{ marginBottom: '.2rem' }}>Context to include</label>
              <label>
                <input type="checkbox" checked={ctxOverview} onChange={e => setCtxOverview(e.target.checked)} />
                {' '}Overview
              </label>
              <label>
                <input type="checkbox" checked={ctxStory} onChange={e => setCtxStory(e.target.checked)} />
                {' '}Recent story
              </label>
              <label>
                <input type="checkbox" checked={ctxSummaries} onChange={e => setCtxSummaries(e.target.checked)} />
                {' '}Summaries
              </label>
              <label>
                <input type="checkbox" checked={ctxLore} onChange={e => setCtxLore(e.target.checked)} />
                {' '}{defaultLoreEntryId ? 'This lore entry' : 'Lore (enabled)'}
              </label>
            </div>

            <button
              className="b ba"
              style={{ width: '100%', marginBottom: '.6rem' }}
              onClick={enhancePrompt}
              disabled={enhancing || !instructions.trim()}
            >
              {enhancing ? <><span className="spn" />Generating prompt...</> : 'Generate Prompt'}
            </button>
          </>
        )}

        {/* Prompt field (always visible) */}
        <div className="gr">
          <label className="lb">Image prompt{mode === 'ai' ? ' (preview / edit)' : ''}</label>
          <ExpandableTextarea
            className="mt"
            value={prompt}
            onChange={v => setPrompt(v)}
            placeholder="The image prompt that will be sent..."
            rows={4}
            title="Image prompt"
          />
        </div>

        {/* Model selector */}
        <div className="gr">
          <label className="lb">Image model</label>
          <div ref={ddRef} style={{ position: 'relative' }}>
            <input
              type="text"
              className="mt"
              style={{ width: '100%', padding: '.45rem .5rem', fontSize: '.82rem' }}
              value={modelSearch}
              onChange={e => { setModelSearch(e.target.value); setShowDD(true) }}
              onFocus={() => { if (imageModels.length) setShowDD(true) }}
              placeholder={imageModels.length ? 'Search model...' : 'Load models first'}
            />
            {showDD && filteredModels.length > 0 && (
              <div className="gm-dd">
                {filteredModels.map(m => (
                  <div
                    key={m.id}
                    className={`gm-dd-opt${m.id === selectedModel ? ' sel' : ''}`}
                    onClick={() => selectModel(m.id)}
                  >{m.id}</div>
                ))}
              </div>
            )}
          </div>
          {imageModels.length === 0 && (
            <button
              className="b bs"
              style={{ marginTop: '.3rem', width: '100%' }}
              onClick={loadModels}
              disabled={loadingModels}
            >
              {loadingModels ? 'Loading...' : 'Load Models'}
            </button>
          )}
        </div>

        {/* Dimensions */}
        <div className="gr">
          <label className="lb">Dimensions</label>
          <div className="gm-dims">
            {DIMENSION_PRESETS.map(p => (
              <button
                key={p.label}
                className={`b bs${activePreset === p.label ? ' ba' : ''}`}
                onClick={() => { setImgW(p.w); setImgH(p.h) }}
              >{p.label}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '.4rem', alignItems: 'end', marginTop: '.4rem' }}>
            <div>
              <label className="lb">Width</label>
              <input
                type="number"
                value={imgW}
                onChange={e => setImgW(Math.max(256, Number(e.target.value) || 256))}
                step={64} min={256} max={2048}
                style={{ textAlign: 'center', fontSize: '.82rem', padding: '.35rem' }}
              />
            </div>
            <span style={{ color: 'var(--mt)', fontSize: '.82rem', paddingBottom: '.45rem' }}>&times;</span>
            <div>
              <label className="lb">Height</label>
              <input
                type="number"
                value={imgH}
                onChange={e => setImgH(Math.max(256, Number(e.target.value) || 256))}
                step={64} min={256} max={2048}
                style={{ textAlign: 'center', fontSize: '.82rem', padding: '.35rem' }}
              />
            </div>
          </div>
        </div>

        {/* Number of images */}
        <div className="gm-sl">
          <label className="lb" style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>Images</label>
          <input
            type="range"
            min={1}
            max={4}
            value={numImages}
            onChange={e => setNumImages(Number(e.target.value))}
          />
          <span className="gm-sv">{numImages}</span>
        </div>

        {/* Error */}
        {error && <div className="er" style={{ marginBottom: '.4rem' }}>{error}</div>}

        {/* Generate button */}
        <button
          className="b ba gm-gen"
          onClick={generate}
          disabled={generating || !prompt.trim() || !selectedModel}
        >
          {generating ? <><span className="spn" />Generating...</> : 'Generate Image'}
        </button>
      </div>
    </div>
  )
}
