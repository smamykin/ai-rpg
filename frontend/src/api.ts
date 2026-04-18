import type { GameState, ModelInfo, Section } from './types'

const BASE = '/api'

async function fetchJSON<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

export async function getState(): Promise<GameState> {
  return fetchJSON<GameState>('/state')
}

export async function saveState(state: GameState): Promise<GameState> {
  return fetchJSON<GameState>('/state', {
    method: 'PUT',
    body: JSON.stringify(state),
  })
}

export async function deleteState(): Promise<void> {
  await fetchJSON('/state', { method: 'DELETE' })
}

export async function exportState(): Promise<Blob> {
  const res = await fetch(BASE + '/state/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  return res.blob()
}

export async function importState(data: string): Promise<GameState> {
  return fetchJSON<GameState>('/state/import', {
    method: 'POST',
    body: data,
  })
}

export async function getModels(): Promise<ModelInfo[]> {
  const res = await fetchJSON<{ models: ModelInfo[] }>('/models')
  return res.models
}

export async function summarize(text: string): Promise<string> {
  const res = await fetchJSON<{ summary: string }>('/summarize', {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
  return res.summary
}

export async function updateStats(
  sections: Section[],
  story: string
): Promise<Section[]> {
  const res = await fetchJSON<{ sections: Section[] }>('/update-stats', {
    method: 'POST',
    body: JSON.stringify({ sections, story }),
  })
  return res.sections
}

export interface GenerateCallbacks {
  onChunk: (text: string) => void
  onDone: (text: string) => void
  onError: (error: string) => void
}

export function generate(
  task: string,
  action: string,
  signal: AbortSignal,
  callbacks: GenerateCallbacks
): void {
  fetch(BASE + '/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, action }),
    signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        callbacks.onError(`HTTP ${res.status}: ${text.slice(0, 300)}`)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        callbacks.onError('No response body')
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const data = trimmed.slice(5).trim()
          if (!data) continue

          try {
            const parsed = JSON.parse(data)
            if (parsed.error) {
              callbacks.onError(parsed.error)
              return
            }
            if (parsed.done) {
              callbacks.onDone(parsed.text || '')
              return
            }
            if (parsed.text) {
              callbacks.onChunk(parsed.text)
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        callbacks.onError(err.message || 'Failed')
      }
    })
}
