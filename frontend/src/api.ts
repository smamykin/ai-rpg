import type { GameState, ModelInfo, ImageModelInfo, PromptPreview, Section, SessionMeta, Scenario } from './types'

const BASE = '/api'

// Active session id — attached to mutating requests as X-Session-Id so the
// server can reject saves that target a session the user has since switched away from.
let currentSessionId = ''
export function setCurrentSessionId(id: string) { currentSessionId = id }
export function getCurrentSessionId() { return currentSessionId }

export class SessionMismatchError extends Error {
  constructor() { super('session mismatch'); this.name = 'SessionMismatchError' }
}

export class NoCurrentSessionError extends Error {
  constructor() { super('no current session'); this.name = 'NoCurrentSessionError' }
}

async function fetchJSON<T>(url: string, opts?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts?.headers as Record<string, string> | undefined) }
  const method = (opts?.method || 'GET').toUpperCase()
  if (method !== 'GET' && currentSessionId) {
    headers['X-Session-Id'] = currentSessionId
  }
  const res = await fetch(BASE + url, { ...opts, headers })
  if (res.status === 409) throw new SessionMismatchError()
  if (res.status === 404 && url === '/state') throw new NoCurrentSessionError()
  if (!res.ok) {
    const text = (await res.text().catch(() => '')).trim().slice(0, 300)
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function getState(): Promise<GameState> {
  return fetchJSON<GameState>('/state')
}

export async function saveState(state: Partial<GameState>): Promise<GameState> {
  return fetchJSON<GameState>('/state', {
    method: 'PUT',
    body: JSON.stringify(state),
  })
}

export async function deleteState(): Promise<void> {
  await fetchJSON('/state', { method: 'DELETE' })
}

export async function resetAllData(): Promise<void> {
  await fetch(BASE + '/data/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function exportState(): Promise<Blob> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (currentSessionId) headers['X-Session-Id'] = currentSessionId
  const res = await fetch(BASE + '/state/export', { method: 'POST', headers })
  return res.blob()
}

export async function importState(data: string): Promise<GameState> {
  return fetchJSON<GameState>('/state/import', {
    method: 'POST',
    body: data,
  })
}

// --- Sessions ---

export interface SessionsListResp {
  sessions: SessionMeta[]
  current?: string
}

export async function listSessions(): Promise<SessionsListResp> {
  return fetchJSON<SessionsListResp>('/sessions')
}

export async function createSession(name: string, scenarioId?: string): Promise<GameState> {
  return fetchJSON<GameState>('/sessions', {
    method: 'POST',
    body: JSON.stringify({ name, scenarioId }),
  })
}

export async function renameSession(id: string, name: string): Promise<void> {
  await fetchJSON(`/sessions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  })
}

export async function deleteSession(id: string): Promise<void> {
  await fetchJSON(`/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function switchSession(id: string): Promise<GameState> {
  return fetchJSON<GameState>('/sessions/current', {
    method: 'PUT',
    body: JSON.stringify({ id }),
  })
}

// --- Scenarios ---

export async function listScenarios(): Promise<Scenario[]> {
  const res = await fetchJSON<{ scenarios: Scenario[] }>('/scenarios')
  return res.scenarios || []
}

export async function getScenario(id: string): Promise<Scenario> {
  return fetchJSON<Scenario>(`/scenarios/${encodeURIComponent(id)}`)
}

export async function createScenario(sc: Partial<Scenario>): Promise<Scenario> {
  return fetchJSON<Scenario>('/scenarios', {
    method: 'POST',
    body: JSON.stringify(sc),
  })
}

export async function updateScenario(id: string, sc: Partial<Scenario>): Promise<Scenario> {
  return fetchJSON<Scenario>(`/scenarios/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(sc),
  })
}

export async function deleteScenario(id: string): Promise<void> {
  await fetchJSON(`/scenarios/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// --- Models + AI ---

export async function getModels(): Promise<ModelInfo[]> {
  const res = await fetchJSON<{ models: ModelInfo[] }>('/models')
  return res.models
}

export async function summarize(text: string, condensed = false): Promise<string> {
  const res = await fetchJSON<{ summary: string }>('/summarize', {
    method: 'POST',
    body: JSON.stringify({ text, condensed }),
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

export async function getImageModels(): Promise<ImageModelInfo[]> {
  const res = await fetchJSON<{ models: ImageModelInfo[] }>('/image-models')
  return res.models
}

export async function generateImages(
  model: string,
  prompt: string,
  n: number,
  width: number,
  height: number
): Promise<{ url: string }[]> {
  const res = await fetchJSON<{ images: { url: string }[] }>('/images/generate', {
    method: 'POST',
    body: JSON.stringify({ model, prompt, n, width, height }),
  })
  return res.images
}

export async function enhanceImagePrompt(
  instructions: string,
  context: {
    recentStory?: string
    summaries?: string
    overview?: string
    imageStyle?: string
    loreEntries?: { name: string; text: string }[]
  }
): Promise<string> {
  const res = await fetchJSON<{ prompt: string }>('/images/enhance-prompt', {
    method: 'POST',
    body: JSON.stringify({ instructions, context }),
  })
  return res.prompt
}

export type LoreLength = 'concise' | 'descriptive' | 'full'
export type LoreMode = 'extract' | 'enhance' | 'creative'

export async function generateLore(
  name: string,
  tag: string,
  instructions: string,
  context: {
    recentStory?: string
    summaries?: string
    overview?: string
    loreEntries?: { name: string; text: string }[]
  },
  length: LoreLength = 'descriptive',
  mode: LoreMode = 'enhance',
): Promise<string> {
  const res = await fetchJSON<{ text: string }>('/lore/generate', {
    method: 'POST',
    body: JSON.stringify({ name, tag, instructions, context, length, mode }),
  })
  return res.text
}

export interface SuggestNameCtx {
  overview?: string
  recentStory?: string
  loreEntries?: { name: string; text: string }[]
}

export async function suggestName(
  kind: 'lore' | 'session' | 'scenario',
  text: string,
  tag?: string,
  context?: SuggestNameCtx
): Promise<string> {
  const res = await fetchJSON<{ name: string }>('/suggest-name', {
    method: 'POST',
    body: JSON.stringify({ kind, text, tag: tag || '', context: context || {} }),
  })
  return res.name
}

export interface TTSRequest {
  text: string
  model: string
  voice: string
  speed?: number
  instructions?: string
}

export async function tts(req: TTSRequest, signal?: AbortSignal): Promise<Blob> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (currentSessionId) headers['X-Session-Id'] = currentSessionId
  const res = await fetch(BASE + '/tts', {
    method: 'POST',
    headers,
    body: JSON.stringify(req),
    signal,
  })
  if (!res.ok) {
    const text = (await res.text().catch(() => '')).trim().slice(0, 300)
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.blob()
}

export async function previewPrompt(task: string, action: string): Promise<PromptPreview> {
  return fetchJSON<PromptPreview>('/prompt/preview', {
    method: 'POST',
    body: JSON.stringify({ task, action }),
  })
}

export async function transform(text: string, instruction: string): Promise<string> {
  const res = await fetchJSON<{ text: string }>('/transform', {
    method: 'POST',
    body: JSON.stringify({ text, instruction }),
  })
  return res.text
}

export interface GenerateCallbacks {
  onChunk: (text: string) => void
  onReasoning?: (text: string) => void
  onDone: (text: string) => void
  onError: (error: string) => void
}

export function generate(
  task: string,
  action: string,
  roll: string,
  signal: AbortSignal,
  callbacks: GenerateCallbacks
): void {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (currentSessionId) headers['X-Session-Id'] = currentSessionId
  fetch(BASE + '/generate', {
    method: 'POST',
    headers,
    body: JSON.stringify({ task, action, roll }),
    signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        const text = (await res.text().catch(() => '')).trim().slice(0, 300)
        callbacks.onError(text || `HTTP ${res.status}`)
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
            if (parsed.reasoning) {
              callbacks.onReasoning?.(parsed.reasoning)
            } else if (parsed.text) {
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
