package api

import (
	"encoding/json"
	"net/http"

	"ai-rpg-v2/internal/nanogpt"
)

func (h *Handlers) GetModels(w http.ResponseWriter, r *http.Request) {
	models, err := h.client.FetchModels(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(struct {
		Models []nanogpt.ModelResponse `json:"models"`
	}{Models: models})
}
