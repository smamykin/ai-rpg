# AI RPG v2

Text-based AI RPG with image generation. Go backend + React frontend, single-user, no database.

## Stack

- **Backend**: Go 1.26, chi v5 router, NanoGPT API (OpenAI-compatible)
- **Frontend**: React 19, TypeScript 6.0, Vite 8
- **Persistence**: JSON file (`data/state.json`), gallery images in browser localStorage
- **Dev**: docker-compose (backend :8081->8080, frontend :5173)
- **API key**: Server-side env var `NANOGPT_API_KEY`

## Dev Environment

- **Node**: Managed via nvm. `.nvmrc` specifies Node 24. Always run `source ~/.nvm/nvm.sh && nvm use` before npm/npx commands.
- **Frontend deps**: `cd frontend && npm install` (node_modules not committed)
- **Type-check**: `cd frontend && npx tsc -b`
- **Build frontend**: `cd frontend && npx vite build`
- **Build backend**: `cd backend && go build ./...`

## Project Structure

```
backend/
  cmd/server/main.go          # Entry point
  internal/api/               # HTTP handlers + router
  internal/game/              # State, prompts, text cleaning
  internal/nanogpt/           # NanoGPT API client
  internal/storage/           # File-based persistence
frontend/
  src/components/             # React components
  src/components/panels/      # Slide-in panels (Memory, Gallery, Tracking, Settings, AI, Menu)
  src/hooks/                  # useGameState (reducer), useGallery (localStorage)
  src/styles/global.css       # All CSS (single file)
  src/types.ts                # Shared types
  src/api.ts                  # Backend API client
data/                         # Runtime state (state.json)
```

## Conventions

- CSS: Ultra-short class names (`.b`, `.bs`, `.ba`, `.pn`, `.hd`, `.gr`, `.lb`, `.mt`). CSS variables for theming (`--bg`, `--sf`, `--bd`, `--tx`, `--mt`, `--ac`, `--dng`).
- State: useReducer with action types (`SET_FIELD`, `ADD_LORE`, `TOGGLE_LORE`, etc.). Auto-saves to backend via debounced PUT.
- Panels: Slide from right. Pattern: `<div className={`ov ${show ? 'o' : ''}`}>` overlay + `<div className={`pn ${show ? 'o' : ''}`}>` panel.
- Backend JSON: camelCase field names in API responses (Go struct tags handle conversion).
- No tests currently.
