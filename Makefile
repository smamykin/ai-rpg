.PHONY: up down build logs restart backend frontend check open prod prod-build prod-down prod-logs

# ── Development ──────────────────────────────────

## Start dev environment
up:
	docker compose up -d

## Start dev with rebuild
up-build:
	docker compose up -d --build

## Stop dev environment
down:
	docker compose down

## Rebuild dev images
build:
	docker compose build

## Follow all logs
logs:
	docker compose logs -f

## Restart a service (usage: make restart s=backend)
restart:
	docker compose restart $(s)

## Backend logs only
backend:
	docker compose logs -f backend

## Frontend logs only
frontend:
	docker compose logs -f frontend

## TypeScript check
check:
	docker compose exec frontend npx tsc --noEmit

## Open dev in browser
open:
	xdg-open http://localhost:5173

# ── Production ───────────────────────────────────

## Build production image
prod-build:
	docker compose -f docker-compose.prod.yml build

## Start production
prod:
	docker compose -f docker-compose.prod.yml up -d

## Stop production
prod-down:
	docker compose -f docker-compose.prod.yml down

## Production logs
prod-logs:
	docker compose -f docker-compose.prod.yml logs -f

# ── Deploy ───────────────────────────────────────

## Deploy to VPS (usage: make deploy host=user@yourserver.com)
deploy:
	ssh $(host) 'cd ~/ai-rpg-v2 && git pull && docker compose -f docker-compose.prod.yml up -d --build'
