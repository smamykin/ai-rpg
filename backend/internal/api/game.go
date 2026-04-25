package api

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"ai-rpg-v2/internal/game"
	"ai-rpg-v2/internal/storage"
)

const HeaderSessionID = "X-Session-Id"

// writeSchemaWipeRequired returns 426 with version metadata so the client can
// show the wipe popup. Returns true if it handled the error.
func writeSchemaWipeRequired(w http.ResponseWriter, err error) bool {
	var se *game.SchemaWipeRequiredError
	if !errors.As(err, &se) {
		return false
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUpgradeRequired)
	json.NewEncoder(w).Encode(map[string]any{
		"error":        "schema_wipe_required",
		"storedMajor":  se.StoredMajor,
		"storedMinor":  se.StoredMinor,
		"currentMajor": se.CurrentMajor,
		"currentMinor": se.CurrentMinor,
	})
	return true
}

// loadCurrent loads the active session, or writes a 404 + returns nil.
func (h *Handlers) loadCurrent(w http.ResponseWriter) *game.GameState {
	st, err := h.sessions.LoadCurrent()
	if errors.Is(err, storage.ErrNoCurrent) || errors.Is(err, storage.ErrNotFound) {
		http.Error(w, "no current session", http.StatusNotFound)
		return nil
	}
	if writeSchemaWipeRequired(w, err) {
		return nil
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return nil
	}
	return st
}

// validateSession checks the X-Session-Id header matches the current session.
// Returns the current id or writes the error response (and returns "").
func (h *Handlers) validateSession(w http.ResponseWriter, r *http.Request) string {
	cur, err := h.sessions.GetCurrent()
	if err != nil {
		http.Error(w, "no current session", http.StatusNotFound)
		return ""
	}
	hdr := r.Header.Get(HeaderSessionID)
	if hdr != "" && hdr != cur {
		http.Error(w, "session mismatch", http.StatusConflict)
		return ""
	}
	return cur
}

func (h *Handlers) GetState(w http.ResponseWriter, r *http.Request) {
	st := h.loadCurrent(w)
	if st == nil {
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(st)
}

func (h *Handlers) PutState(w http.ResponseWriter, r *http.Request) {
	curID := h.validateSession(w, r)
	if curID == "" {
		return
	}

	existing, err := h.sessions.Get(curID)
	if writeSchemaWipeRequired(w, err) {
		return
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var incoming game.GameState
	if err := json.NewDecoder(r.Body).Decode(&incoming); err != nil {
		http.Error(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Preserve server-owned fields; replace everything else from the body.
	incoming.SessionID = existing.SessionID
	incoming.CreatedAt = existing.CreatedAt
	if incoming.Name == "" {
		incoming.Name = existing.Name
	}
	if incoming.ModelRoles == nil {
		incoming.ModelRoles = existing.ModelRoles
	}

	if err := h.sessions.Save(curID, &incoming); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(&incoming)
}

// DeleteState deletes the current session and clears the current pointer.
func (h *Handlers) DeleteState(w http.ResponseWriter, r *http.Request) {
	cur, err := h.sessions.GetCurrent()
	if err != nil {
		// Nothing to delete — treat as success.
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
		return
	}
	if err := h.sessions.Delete(cur); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (h *Handlers) ExportState(w http.ResponseWriter, r *http.Request) {
	cur, err := h.sessions.GetCurrent()
	if err != nil {
		http.Error(w, "no current session", http.StatusNotFound)
		return
	}
	data, err := h.sessions.ExportJSON(cur)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", `attachment; filename="adventure.json"`)
	w.Write(data)
}

// ResetAllData wipes every session and scenario from disk.
func (h *Handlers) ResetAllData(w http.ResponseWriter, r *http.Request) {
	if err := h.sessions.DeleteAll(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if err := h.scenarios.DeleteAll(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// ImportState creates a new session from JSON and sets it as current.
func (h *Handlers) ImportState(w http.ResponseWriter, r *http.Request) {
	data, err := io.ReadAll(io.LimitReader(r.Body, 25<<20)) // 25MB
	if err != nil {
		http.Error(w, "read body: "+err.Error(), http.StatusBadRequest)
		return
	}

	state, err := h.sessions.ImportJSON(data)
	if writeSchemaWipeRequired(w, err) {
		return
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := h.sessions.SetCurrent(state.SessionID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(state)
}
