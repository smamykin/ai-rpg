package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"ai-rpg-v2/internal/game"
	"ai-rpg-v2/internal/storage"

	"github.com/go-chi/chi/v5"
)

type createSessionReq struct {
	Name       string `json:"name"`
	ScenarioID string `json:"scenarioId,omitempty"` // reserved for Phase 3
}

type renameSessionReq struct {
	Name string `json:"name"`
}

type switchSessionReq struct {
	ID string `json:"id"`
}

type sessionsListResp struct {
	Sessions []storage.SessionMeta `json:"sessions"`
	Current  string                `json:"current,omitempty"`
}

func (h *Handlers) ListSessions(w http.ResponseWriter, r *http.Request) {
	metas, err := h.sessions.List()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	cur, _ := h.sessions.GetCurrent()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sessionsListResp{Sessions: metas, Current: cur})
}

func (h *Handlers) CreateSession(w http.ResponseWriter, r *http.Request) {
	var req createSessionReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = "Adventure"
	}

	var seed *game.GameState
	if strings.TrimSpace(req.ScenarioID) != "" {
		s, err := h.scenarios.InstantiateSession(req.ScenarioID)
		if err != nil {
			if errors.Is(err, storage.ErrScenarioNotFound) {
				http.Error(w, "scenario not found", http.StatusNotFound)
				return
			}
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		seed = s
	}

	st, err := h.sessions.Create(name, seed)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if err := h.sessions.SetCurrent(st.SessionID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(st)
}

func (h *Handlers) RenameSession(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req renameSessionReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}
	if err := h.sessions.Rename(id, req.Name); err != nil {
		if errors.Is(err, storage.ErrNotFound) {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (h *Handlers) DeleteSession(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.sessions.Delete(id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (h *Handlers) SwitchSession(w http.ResponseWriter, r *http.Request) {
	var req switchSessionReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}
	if err := h.sessions.SetCurrent(req.ID); err != nil {
		if errors.Is(err, storage.ErrNotFound) {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	st, err := h.sessions.Get(req.ID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(st)
}
