package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

type GenerateLoreRequest struct {
	Name         string          `json:"name"`
	Tag          string          `json:"tag"`
	Instructions string          `json:"instructions"`
	Context      GenerateLoreCtx `json:"context"`
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

	// Name is no longer required — content can be generated from instructions + context alone.
	// A name is still preferred when present.
	if strings.TrimSpace(req.Name) == "" && strings.TrimSpace(req.Instructions) == "" {
		http.Error(w, "name or instructions required", http.StatusBadRequest)
		return
	}

	state, err := h.sessions.LoadCurrent()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	model := h.resolveModel("loreGen", state)

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
	if strings.TrimSpace(req.Name) != "" {
		fmt.Fprintf(&sb, "Create a lore entry for: %s (category: %s)\n", req.Name, req.Tag)
	} else {
		fmt.Fprintf(&sb, "Create a lore entry (category: %s)\n", req.Tag)
	}

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

// --- Naming ---

type SuggestNameRequest struct {
	Kind    string         `json:"kind"`    // "lore", "session", "scenario"
	Text    string         `json:"text"`    // the primary seed (lore body, adventure overview, etc.)
	Tag     string         `json:"tag"`     // optional (for lore: world/character/rule/...)
	Context SuggestNameCtx `json:"context"` // optional background
}

type SuggestNameCtx struct {
	Overview    string             `json:"overview,omitempty"`
	RecentStory string             `json:"recentStory,omitempty"`
	LoreEntries []LoreEntryContext `json:"loreEntries,omitempty"`
}

// SuggestName produces a short (1–4 word) name for a lore entry, session, or scenario.
func (h *Handlers) SuggestName(w http.ResponseWriter, r *http.Request) {
	var req SuggestNameRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	state, err := h.sessions.LoadCurrent()
	if err != nil {
		state = nil // naming can run even without a current session
	}
	model := h.resolveModel("naming", state)
	if model == "" && state == nil {
		model = h.cfg.SupportModel
		if model == "" {
			model = h.cfg.StoryModel
		}
	}

	kind := strings.TrimSpace(req.Kind)
	if kind == "" {
		kind = "entity"
	}

	var sys string
	switch kind {
	case "lore":
		sys = "You name lore entries for a text-based RPG. Output ONLY a short title (1-4 words, Title Case, no punctuation, no quotes)."
	case "session":
		sys = "You name adventures. Output ONLY a short evocative title (2-5 words, Title Case, no punctuation, no quotes)."
	case "scenario":
		sys = "You name RPG scenario templates. Output ONLY a short evocative title (2-5 words, Title Case, no punctuation, no quotes)."
	default:
		sys = "You name things. Output ONLY a short title (1-5 words, Title Case, no punctuation, no quotes)."
	}

	var sb strings.Builder
	if req.Tag != "" {
		fmt.Fprintf(&sb, "Category: %s\n", req.Tag)
	}
	if strings.TrimSpace(req.Text) != "" {
		fmt.Fprintf(&sb, "\nContent:\n%s\n", strings.TrimSpace(req.Text))
	}
	if req.Context.Overview != "" {
		fmt.Fprintf(&sb, "\n--- Adventure Overview ---\n%s\n", req.Context.Overview)
	}
	if req.Context.RecentStory != "" {
		fmt.Fprintf(&sb, "\n--- Recent Story ---\n%s\n", req.Context.RecentStory)
	}
	if len(req.Context.LoreEntries) > 0 {
		sb.WriteString("\n--- Existing Lore ---\n")
		for _, l := range req.Context.LoreEntries {
			fmt.Fprintf(&sb, "- %s\n", l.Name)
		}
	}
	if sb.Len() == 0 {
		sb.WriteString("(no context provided; invent a fitting title)")
	}

	result, err := h.client.Complete(r.Context(), model, sys, sb.String(), 30)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}

	name := strings.TrimSpace(result)
	name = strings.Trim(name, `"'`)
	// drop a trailing period if present
	name = strings.TrimRight(name, ".")
	// collapse multi-line responses to first line
	if i := strings.IndexAny(name, "\n\r"); i >= 0 {
		name = name[:i]
	}
	if len(name) > 80 {
		name = name[:80]
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"name": name})
}
