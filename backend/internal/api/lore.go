package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

type GenerateLoreRequest struct {
	Name         string           `json:"name"`
	Tag          string           `json:"tag"`
	Instructions string           `json:"instructions"`
	Context      GenerateLoreCtx  `json:"context"`
}

type GenerateLoreCtx struct {
	RecentStory string             `json:"recentStory,omitempty"`
	Summaries   string             `json:"summaries,omitempty"`
	Overview    string             `json:"overview,omitempty"`
	LoreEntries []LoreEntryContext `json:"loreEntries,omitempty"`
}

// GenerateLore uses AI to create lore entry content from the story context.
func (h *Handlers) GenerateLore(w http.ResponseWriter, r *http.Request) {
	var req GenerateLoreRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(req.Name) == "" {
		http.Error(w, "name required", http.StatusBadRequest)
		return
	}

	state, err := h.store.Load()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	model := h.resolveSupportModel(state)

	systemPrompt := `You are a lore keeper for a text-based RPG. Given a name and category, extract and compile everything known about this subject from the provided story context.

Rules:
- Output ONLY the lore entry text, nothing else.
- Write in present tense, encyclopedic style.
- Include all known facts: appearance, personality, abilities, relationships, history, location, significance.
- If little is known, write what IS known and note what remains unclear.
- Be concise but thorough. Aim for 2-5 sentences.
- Do NOT invent facts not supported by the context.
- If the user provides specific instructions, follow them.`

	var sb strings.Builder
	fmt.Fprintf(&sb, "Create a lore entry for: %s (category: %s)\n", req.Name, req.Tag)

	if strings.TrimSpace(req.Instructions) != "" {
		fmt.Fprintf(&sb, "\nAdditional instructions: %s\n", req.Instructions)
	}

	if req.Context.Overview != "" {
		fmt.Fprintf(&sb, "\n--- Adventure Overview ---\n%s\n", req.Context.Overview)
	}
	if req.Context.Summaries != "" {
		fmt.Fprintf(&sb, "\n--- Story Summaries ---\n%s\n", req.Context.Summaries)
	}
	if req.Context.RecentStory != "" {
		fmt.Fprintf(&sb, "\n--- Recent Story ---\n%s\n", req.Context.RecentStory)
	}
	if len(req.Context.LoreEntries) > 0 {
		sb.WriteString("\n--- Existing Lore ---\n")
		for _, l := range req.Context.LoreEntries {
			fmt.Fprintf(&sb, "**%s**: %s\n", l.Name, l.Text)
		}
	}

	result, err := h.client.Complete(r.Context(), model, systemPrompt, sb.String(), 500)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"text": strings.TrimSpace(result)})
}
