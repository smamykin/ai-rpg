import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import SelectionToolbar from './SelectionToolbar'
import * as api from '../api'

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function formatInline(text: string): string {
  let s = escapeHtml(text)
  // Bold: **text**
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // Italic: *text* (not preceded/followed by *)
  s = s.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
  // Dialogue: "text" or \u201ctext\u201d
  s = s.replace(/["\u201c]([^"\u201c\u201d]+?)["\u201d]/g, '<span class="dq">\u201c$1\u201d</span>')
  return s
}

interface Props {
  story: string
  gen: boolean
  streaming: string
  onChange: (story: string) => void
  pinScroll: boolean
  onReadAloud: (text: string) => void
}

export default function StoryArea({ story, gen, streaming, onChange, pinScroll, onReadAloud }: Props) {
  const ta = useRef<HTMLTextAreaElement>(null)
  const rd = useRef<HTMLDivElement>(null)
  const [editing, setEditing] = useState(false)
  const [transforming, setTransforming] = useState(false)

  // Scroll pinning during streaming
  useEffect(() => {
    if (!pinScroll || !gen) return
    const el = rd.current
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 140) {
      el.scrollTop = el.scrollHeight
    }
  }, [streaming, gen, pinScroll])

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (editing && ta.current) {
      ta.current.focus()
      ta.current.scrollTop = ta.current.scrollHeight
    }
  }, [editing])

  // Rendered paragraphs for read view
  const paragraphs = useMemo(() => {
    if (!story.trim()) return []
    return story.split(/\n\n/).filter(p => p.trim())
  }, [story])

  // Replace selected text in story, then return to read-view
  const handleReplace = useCallback((original: string, replacement: string) => {
    // Try direct match first
    let idx = story.indexOf(original)
    if (idx === -1) {
      // Try matching with smart quotes normalized to regular quotes
      const normalized = original.replace(/[\u201c\u201d]/g, '"')
      idx = story.indexOf(normalized)
    }
    if (idx !== -1) {
      const matchStr = story.indexOf(original) !== -1 ? original : original.replace(/[\u201c\u201d]/g, '"')
      onChange(story.slice(0, idx) + replacement + story.slice(idx + matchStr.length))
    }
    setEditing(false)
  }, [story, onChange])

  // Handle click on read-view: only enter edit mode if no text is selected and not transforming
  const handleClick = useCallback(() => {
    if (gen || transforming) return
    const sel = window.getSelection()
    if (sel && !sel.isCollapsed) return
    setEditing(true)
  }, [gen, transforming])

  // Textarea for editing (only when not generating)
  if (editing && !gen && !transforming) {
    return (
      <textarea
        ref={ta}
        className="sta"
        value={story}
        onChange={e => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        spellCheck
      />
    )
  }

  // Read view (default + during generation)
  return (
    <>
      <div
        ref={rd}
        className="rd"
        onClick={handleClick}
        style={gen || transforming ? undefined : { cursor: 'text' }}
      >
        {paragraphs.length === 0 && !gen && (
          <p className="rd-ph">Your adventure will appear here...</p>
        )}
        {paragraphs.map((p, i) => {
          if (p.startsWith('> ')) {
            return <div key={i} className="pa" dangerouslySetInnerHTML={{ __html: formatInline(p.slice(2)) }} />
          }
          return <p key={i} dangerouslySetInnerHTML={{ __html: formatInline(p) }} />
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
    </>
  )
}
