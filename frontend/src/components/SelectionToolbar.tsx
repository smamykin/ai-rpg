import { useState, useEffect, useCallback, useRef } from 'react'

interface Props {
  containerRef: React.RefObject<HTMLDivElement | null>
  onReplace: (original: string, replacement: string) => void
  onTransform: (text: string, instruction: string) => Promise<string>
  onLoadingChange: (loading: boolean) => void
}

export default function SelectionToolbar({ containerRef, onReplace, onTransform, onLoadingChange }: Props) {
  const [selected, setSelected] = useState('')
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [mode, setMode] = useState<'idle' | 'input' | 'loading'>('idle')
  const [instruction, setInstruction] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const interacting = useRef(false)

  const checkSelection = useCallback(() => {
    // Don't clear while toolbar is being clicked or during loading/input
    if (interacting.current) return

    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !containerRef.current) {
      setSelected('')
      setPos(null)
      setMode('idle')
      return
    }

    // Only show if selection is inside the read-view container
    const range = sel.getRangeAt(0)
    if (!containerRef.current.contains(range.commonAncestorContainer)) {
      setSelected('')
      setPos(null)
      return
    }

    const text = sel.toString().trim()
    if (!text) {
      setSelected('')
      setPos(null)
      return
    }

    const rect = range.getBoundingClientRect()
    setSelected(text)
    setPos({
      x: Math.min(rect.left + rect.width / 2, window.innerWidth - 160),
      y: rect.top - 44,
    })
  }, [containerRef])

  useEffect(() => {
    document.addEventListener('selectionchange', checkSelection)
    return () => document.removeEventListener('selectionchange', checkSelection)
  }, [checkSelection])

  // Focus input when entering input mode
  useEffect(() => {
    if (mode === 'input') inputRef.current?.focus()
  }, [mode])

  if (!selected || !pos) return null

  const dismiss = () => {
    setSelected('')
    setPos(null)
    setMode('idle')
    setInstruction('')
    interacting.current = false
    window.getSelection()?.removeAllRanges()
  }

  const handleFix = async () => {
    setMode('loading')
    onLoadingChange(true)
    try {
      const result = await onTransform(selected, 'Fix grammar, spelling, and punctuation errors')
      onReplace(selected, result)
    } catch { /* ignore */ }
    onLoadingChange(false)
    dismiss()
  }

  const handleTransform = async () => {
    if (!instruction.trim()) return
    setMode('loading')
    onLoadingChange(true)
    try {
      const result = await onTransform(selected, instruction.trim())
      onReplace(selected, result)
    } catch { /* ignore */ }
    onLoadingChange(false)
    dismiss()
  }

  // Position above selection, or below if too close to top
  const top = pos.y < 50 ? pos.y + 88 : pos.y

  return (
    <div
      ref={toolbarRef}
      className="stb"
      style={{ left: Math.max(8, pos.x - 80), top }}
      onMouseDown={e => {
        e.preventDefault()
        interacting.current = true
      }}
      onTouchStart={() => { interacting.current = true }}
    >
      {mode === 'idle' && (
        <>
          <button className="b bs" onClick={handleFix}>Fix</button>
          <button className="b bs" onClick={() => setMode('input')}>Make it&hellip;</button>
        </>
      )}
      {mode === 'input' && (
        <>
          <input
            ref={inputRef}
            type="text"
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleTransform(); if (e.key === 'Escape') dismiss() }}
            placeholder="e.g. more dramatic"
            className="stb-in"
            onMouseDown={e => e.stopPropagation()}
          />
          <button className="b bs" onClick={handleTransform} disabled={!instruction.trim()}>Go</button>
        </>
      )}
      {mode === 'loading' && (
        <span className="stb-ld"><span className="spn" /> Working...</span>
      )}
    </div>
  )
}
