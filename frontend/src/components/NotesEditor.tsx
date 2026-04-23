import { useState } from 'react'
import type { Note } from '../types'
import { uid } from '../types'
import EditorModal from './EditorModal'

interface Props {
  notes: Note[]
  onAdd: (note: Note) => void
  onUpdate: (id: string, body: string) => void
  onDelete: (id: string) => void
}

function firstLine(body: string): string {
  const line = body.split('\n').find(l => l.trim())
  return line ? line.trim() : ''
}

export default function NotesEditor({ notes, onAdd, onUpdate, onDelete }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const editing = notes.find(n => n.id === editingId) || null

  const handleAdd = () => {
    const now = Math.floor(Date.now() / 1000)
    const n: Note = { id: uid('n'), body: '', createdAt: now, updatedAt: now }
    onAdd(n)
    setEditingId(n.id)
  }

  return (
    <>
      <div className="gr">
        <button className="b bs ba" onClick={handleAdd}>+ Add note</button>
      </div>

      {notes.length === 0 ? (
        <div className="hint">No notes yet. Use these for private scratch — theories, NPC reminders, plans. Not sent to the AI.</div>
      ) : (
        <div className="nt-list">
          {notes.map(n => {
            const preview = firstLine(n.body)
            const empty = !preview
            return (
              <button
                key={n.id}
                type="button"
                className={`mtf ${empty ? 'mtf-e' : ''}`}
                style={{ ['--mtf-lines' as string]: 1 }}
                onClick={() => setEditingId(n.id)}
                title="Click to edit"
              >
                <span className="mtf-v">{empty ? 'Empty note — click to edit…' : preview}</span>
                <span className="mtf-i" aria-hidden>&#x2922;</span>
              </button>
            )
          })}
        </div>
      )}

      {editing && (
        <EditorModal
          title="Note"
          value={editing.body}
          placeholder="Write anything — first line becomes the title in the list."
          onSave={v => { onUpdate(editing.id, v); setEditingId(null) }}
          onClose={() => setEditingId(null)}
          extraActions={[{
            label: 'Delete',
            danger: true,
            onClick: () => { onDelete(editing.id); setEditingId(null) },
          }]}
        />
      )}
    </>
  )
}
