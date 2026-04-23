import { useEffect, useRef, useState, useCallback } from 'react'
import type { Turn, GalleryImage } from '../types'
import EditorModal from './EditorModal'
import SelectionToolbar from './SelectionToolbar'
import * as api from '../api'

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function formatInline(text: string): string {
  let s = escapeHtml(text)
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
  s = s.replace(/["\u201c]([^"\u201c\u201d]+?)["\u201d]/g, '<span class="dq">\u201c$1\u201d</span>')
  return s
}

// Serialize a turn to the raw text form the user edits in the modal.
function turnToText(t: Turn): string {
  if (t.action) {
    return t.response ? '> ' + t.action + '\n\n' + t.response : '> ' + t.action
  }
  return t.response
}

// Parse the edited raw text back into { action, response }. The first `> ` line
// (if present, either at the start or only line) becomes the action; everything
// else is the response.
function textToTurnPatch(text: string): { action?: string; response: string } {
  const trimmed = text.replace(/^\s+|\s+$/g, '')
  if (trimmed.startsWith('> ')) {
    const nlIdx = trimmed.indexOf('\n')
    if (nlIdx === -1) {
      return { action: trimmed.slice(2).trim(), response: '' }
    }
    const action = trimmed.slice(2, nlIdx).trim()
    const response = trimmed.slice(nlIdx + 1).replace(/^\s+/, '')
    return { action, response }
  }
  return { response: trimmed }
}

interface Props {
  turns: Turn[]
  gen: boolean
  streaming: string
  onTurnEdit: (turnId: string, patch: Partial<Turn>) => void
  onTurnDelete: (turnId: string) => void
  pinScroll: boolean
  scrollRequest?: number
  onReadAloud: (text: string) => void
  galleryImages?: GalleryImage[]
  onOpenImage?: (imageId: string) => void
}

export default function StoryArea({ turns, gen, streaming, onTurnEdit, onTurnDelete, pinScroll, scrollRequest, onReadAloud, galleryImages, onOpenImage }: Props) {
  const rd = useRef<HTMLDivElement>(null)
  const [editingTurnId, setEditingTurnId] = useState<string | null>(null)
  const [transforming, setTransforming] = useState(false)

  useEffect(() => {
    if (!pinScroll || !gen) return
    const el = rd.current
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 140) {
      el.scrollTop = el.scrollHeight
    }
  }, [streaming, gen, pinScroll])

  // Imperative scroll-to-bottom (bumped when user re-engages pin or a new gen starts).
  // Bypasses the 140px guard so a click always lands at the bottom.
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    const el = rd.current
    if (el) el.scrollTop = el.scrollHeight
  }, [scrollRequest])

  const editingTurn = editingTurnId ? turns.find(t => t.id === editingTurnId) : null

  const handleSave = useCallback((raw: string) => {
    if (!editingTurnId) return
    const patch = textToTurnPatch(raw)
    onTurnEdit(editingTurnId, patch)
    setEditingTurnId(null)
  }, [editingTurnId, onTurnEdit])

  const handleDelete = useCallback(() => {
    if (!editingTurnId) return
    onTurnDelete(editingTurnId)
    setEditingTurnId(null)
  }, [editingTurnId, onTurnDelete])

  const handleTurnClick = useCallback((turnId: string) => {
    if (gen || transforming) return
    const sel = window.getSelection()
    if (sel && !sel.isCollapsed) return
    setEditingTurnId(turnId)
  }, [gen, transforming])

  const handleReplace = useCallback((original: string, replacement: string) => {
    // Find which turn contains the original text and patch only its response.
    for (const t of turns) {
      const haystack = t.response
      let idx = haystack.indexOf(original)
      if (idx === -1) {
        const normalized = original.replace(/[\u201c\u201d]/g, '"')
        idx = haystack.indexOf(normalized)
        if (idx !== -1) {
          onTurnEdit(t.id, { response: haystack.slice(0, idx) + replacement + haystack.slice(idx + normalized.length) })
          return
        }
      }
      if (idx !== -1) {
        onTurnEdit(t.id, { response: haystack.slice(0, idx) + replacement + haystack.slice(idx + original.length) })
        return
      }
    }
  }, [turns, onTurnEdit])

  return (
    <>
      <div ref={rd} className="rd" style={gen || transforming ? undefined : { cursor: 'text' }}>
        {turns.length === 0 && !gen && (
          <p className="rd-ph">Your adventure will appear here...</p>
        )}
        {turns.map(t => {
          const paragraphs = t.response.split(/\n\n/).filter(p => p.trim())
          const cls = t.action ? 'tn' : 'tn tn-na'
          const turnImgs = galleryImages ? galleryImages.filter(i => i.turnId === t.id) : []
          return (
            <div key={t.id} className={cls} onClick={() => handleTurnClick(t.id)}>
              {t.action && (
                <div className="pa" dangerouslySetInnerHTML={{ __html: formatInline(t.action) }} />
              )}
              {paragraphs.map((p, i) => (
                <p key={i} dangerouslySetInnerHTML={{ __html: formatInline(p) }} />
              ))}
              {turnImgs.length > 0 && onOpenImage && (
                <div className="tn-imgs" onClick={e => e.stopPropagation()}>
                  {turnImgs.map(img => (
                    <img
                      key={img.id}
                      src={img.url}
                      alt=""
                      loading="lazy"
                      onClick={() => onOpenImage(img.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {!gen && (
          <SelectionToolbar
            containerRef={rd}
            onReplace={handleReplace}
            onTransform={api.transform}
            onLoadingChange={setTransforming}
            onReadAloud={onReadAloud}
          />
        )}
      </div>
      {transforming && (
        <div className="gb">
          <span className="gd">&#x25cf;</span>
          Transforming text...
        </div>
      )}
      {editingTurn && (
        <EditorModal
          title={editingTurn.action ? '> ' + editingTurn.action.slice(0, 50) : 'Edit turn'}
          value={turnToText(editingTurn)}
          onSave={handleSave}
          onClose={() => setEditingTurnId(null)}
          extraActions={[{ label: 'Delete turn', onClick: handleDelete, danger: true }]}
        />
      )}
    </>
  )
}
