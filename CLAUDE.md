# AI RPG v2

Text-based AI RPG with image generation and TTS. Go backend + React frontend, single-user, no database.

## Stack

- **Backend**: Go 1.26, chi v5 router + cors, NanoGPT API (OpenAI-compatible) for chat/image/TTS
- **Frontend**: React 19, TypeScript 6.0, Vite 8
- **Persistence**: JSON files under `data/` (current session, scenarios, sessions). Gallery images in browser localStorage.
- **Dev**: docker-compose (backend :8081->8080, frontend :5173)
- **API key**: Server-side env var `NANOGPT_API_KEY` (loaded from `.env`)

## Dev Environment

- **Node**: Managed via nvm. `.nvmrc` specifies Node 24. Always run `source ~/.nvm/nvm.sh && nvm use` before npm/npx commands.
- **Frontend deps**: `cd frontend && npm install` (node_modules not committed)
- **Type-check**: `cd frontend && npx tsc -b` (or `make check` inside the container)
- **Build frontend**: `cd frontend && npx vite build`
- **Build backend**: `cd backend && go build ./...`
- **Makefile**: `make up`, `make down`, `make logs`, `make restart s=backend`, `make check`, `make prod`, `make deploy host=user@host`

## Project Structure

```
backend/
  cmd/server/main.go          # Entry point
  internal/api/               # HTTP handlers (game, generate, image, lore, models, scenarios, sessions, tts) + router
  internal/game/              # state.go, prompt.go, clean.go (text cleaning)
  internal/nanogpt/           # client.go (chat/image), tts.go
  internal/storage/           # File-based persistence (migrate, scenarios, sessions)
frontend/
  src/components/             # Hub, Setup, Playing, StoryArea, ActionInput, Lightbox, ScenarioEditor, ScenarioPicker, RewindModal, GenerateImageModal, SaveAsScenarioModal, LoreEditor, ModelPicker, PanelTabs, SelectionToolbar, SuggestNameButton, Toast
  src/components/panels/      # Slide-in panels (Memory, Gallery, Tracking, Outline, Settings, AI, Menu)
  src/hooks/                  # useGameState (reducer), useGallery, useSessions, useDisplayPrefs, useToast, useTTS
  src/constants/              # tts.ts
  src/utils/                  # budget.ts
  src/styles/global.css       # All CSS (single file)
  src/types.ts                # Shared types
  src/api.ts                  # Backend API client
  src/display.ts              # Display helpers
data/
  current.json                # Active session state
  scenarios/                  # Saved scenario JSON files
  sessions/                   # Saved session JSON files
```

## Conventions

- CSS: Ultra-short class names (`.b`, `.bs`, `.ba`, `.pn`, `.hd`, `.gr`, `.lb`, `.mt`). CSS variables for theming (`--bg`, `--sf`, `--bd`, `--tx`, `--mt`, `--ac`, `--dng`).
- State: useReducer with action types (`SET_FIELD`, `ADD_LORE`, `TOGGLE_LORE`, etc.). Auto-saves to backend via debounced PUT.
- Panels: Slide from right. Pattern: `<div className={`ov ${show ? 'o' : ''}`}>` overlay + `<div className={`pn ${show ? 'o' : ''}`}>` panel.
- Backend JSON: camelCase field names in API responses (Go struct tags handle conversion).
- No tests currently.
