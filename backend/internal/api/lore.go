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
	Length       string          `json:"length"` // "concise" | "descriptive" | "full"
	Mode         string          `json:"mode"`   // "extract" | "enhance" | "creative"
	Context      GenerateLoreCtx `json:"context"`
}

var loreLengthDirectives = map[string]string{
	"concise":     "2-4 sentences, densest possible.",
	"descriptive": "1-2 paragraphs with room for detail.",
	"full":        "3-5 paragraphs, encyclopedia-style, cover every focus area fully. Use short sub-labels (History, Appearance, Role, etc.) if it helps organize.",
}

var loreModeDirectives = map[string]string{
	"extract":  "Use ONLY facts in the context tags. If a focus area has no support, say what is unclear or unknown. Invent nothing.",
	"enhance":  "Start from what the context tags say, then enrich with plausible, genre-fitting invention. Never contradict the context. Every fact in the context must survive; additions must be consistent.",
	"creative": "Invent the entry. Context tags are constraints — do not contradict them — but feel free to introduce new, fitting details.",
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

	// Tolerate no current session — scenario editing runs without one.
	// Context comes from the request body; state is only needed for model-role overrides.
	state, _ := h.sessions.LoadCurrent()
	model := h.resolveModel("loreGen", state)

	systemPrompt := `You are a lore keeper for a text-based RPG. You produce a single lore entry based on the provided context tags (<overview>, <story_summaries>, <recent_story>, <existing_lore>) and any <example> shown. Follow the <task> exactly. <user_instructions>, when present, override every rule.

Rules:
- Output ONLY the lore entry text — no labels, no headers, no commentary.
- Write in present tense, encyclopedic style.`

	focusByTag := map[string]string{
		"character": "Role or occupation, appearance, demeanor, relationships, goals, secrets.",
		"world":     "Scope, history, culture, cosmology, notable features, role in the story.",
		"location":  "Geography, atmosphere, inhabitants, landmarks, strategic or narrative significance.",
		"faction":   "Composition, goals, methods, allies, rivals, current power and reach.",
		"mechanic":  "When and where it applies, exact constraints, exceptions, consequences of breaking it.",
		"quest":     "Giver, objective, reward, complications, current state.",
		"item":      "Origin, appearance, powers or properties, current owner or location, history.",
		"creature":  "Habitat, appearance, behavior, abilities, threat level, lore or origin.",
		"other":     "Whatever is most salient about the subject.",
	}

	length := strings.TrimSpace(req.Length)
	if _, ok := loreLengthDirectives[length]; !ok {
		length = "descriptive"
	}
	mode := strings.TrimSpace(req.Mode)
	if _, ok := loreModeDirectives[mode]; !ok {
		mode = "enhance"
	}

	var sb strings.Builder

	// Context blocks first.
	if req.Context.Overview != "" {
		fmt.Fprintf(&sb, "<overview>\n%s\n</overview>\n\n", req.Context.Overview)
	}
	if req.Context.Summaries != "" {
		fmt.Fprintf(&sb, "<story_summaries>\n%s\n</story_summaries>\n\n", req.Context.Summaries)
	}
	if req.Context.RecentStory != "" {
		fmt.Fprintf(&sb, "<recent_story>\n%s\n</recent_story>\n\n", req.Context.RecentStory)
	}
	if len(req.Context.LoreEntries) > 0 {
		sb.WriteString("<existing_lore>\n")
		for _, l := range req.Context.LoreEntries {
			fmt.Fprintf(&sb, "**%s**: %s\n", l.Name, l.Text)
		}
		sb.WriteString("</existing_lore>\n\n")
	}

	// One-shot example — only for character entries, where a concrete template lifts quality the most.
	if req.Tag == "character" {
		sb.WriteString("<example>\n")
		sb.WriteString("Request: Create a lore entry for Mira (character)\n")
		sb.WriteString("Entry: Mira is a former caravan guard turned courier in the lower district. Lean and quick, with a scar along her left jaw from a roadside ambush she refuses to discuss. Loyal to few but fiercely so; owes a debt to the innkeeper Calum. Wants out of the city but cannot leave until the debt is paid.\n")
		sb.WriteString("</example>\n\n")
	}

	// Task block.
	sb.WriteString("<task>\n")
	if strings.TrimSpace(req.Name) != "" {
		fmt.Fprintf(&sb, "Create a lore entry for: %s (category: %s).\n", req.Name, req.Tag)
	} else {
		fmt.Fprintf(&sb, "Create a lore entry (category: %s).\n", req.Tag)
	}
	if focus, ok := focusByTag[req.Tag]; ok {
		fmt.Fprintf(&sb, "Focus areas: %s\n", focus)
	}
	fmt.Fprintf(&sb, "Length: %s\n", loreLengthDirectives[length])
	fmt.Fprintf(&sb, "Approach: %s\n", loreModeDirectives[mode])
	sb.WriteString("</task>\n")

	// User instructions last so they override everything.
	if strings.TrimSpace(req.Instructions) != "" {
		fmt.Fprintf(&sb, "\n<user_instructions>\n%s\n</user_instructions>\n", strings.TrimSpace(req.Instructions))
	}

	result, err := h.client.Complete(r.Context(), model, systemPrompt, sb.String(), state.TokenCap("lore"), "")
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
	Tag     string         `json:"tag"`     // optional (for lore: world/location/faction/character/mechanic/...)
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
	fmt.Fprintf(&sb, "Suggest a name for this %s.\n", kind)
	if req.Tag != "" {
		fmt.Fprintf(&sb, "Category: %s\n", req.Tag)
	}
	if seed := strings.TrimSpace(req.Text); seed != "" {
		fmt.Fprintf(&sb, "\n%s", seed)
	} else {
		sb.WriteString("\nNo context provided — invent a fitting title.")
	}

	result, err := h.client.Complete(r.Context(), model, sys, sb.String(), state.TokenCap("naming"), "")
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
