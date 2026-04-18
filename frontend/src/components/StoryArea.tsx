import { useEffect, useRef } from 'react'

interface Props {
  story: string
  gen: boolean
  streaming: string
  onChange: (story: string) => void
}

export default function StoryArea({ story, gen, streaming, onChange }: Props) {
  const ta = useRef<HTMLTextAreaElement>(null)

  // Scroll pinning during streaming
  useEffect(() => {
    if (gen && ta.current) {
      const el = ta.current
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 140) {
        el.scrollTop = el.scrollHeight
      }
    }
  }, [streaming, gen])

  return (
    <textarea
      ref={ta}
      className="sta"
      value={story}
      onChange={e => { if (!gen) onChange(e.target.value) }}
      readOnly={gen}
      placeholder="Your adventure will appear here..."
      spellCheck={!gen}
    />
  )
}
