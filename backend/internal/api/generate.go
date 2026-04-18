package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"ai-rpg-v2/internal/game"
)

type GenerateRequest struct {
	Task   string `json:"task"`   // "open", "action", "continue"
	Action string `json:"action"` // player's action text (for task="action")
}

type SummarizeRequest struct {
	Text      string `json:"text"`      // text to summarize
	Condensed bool   `json:"condensed"` // true = condense multiple summaries into one
}

type UpdateStatsRequest struct {
	Sections []game.Section `json:"sections"`
	Story    string         `json:"story"` // recent story for context
}

// resolveSupportModel picks the support model: state → env support → env story → state story.
func (h *Handlers) resolveSupportModel(state *game.GameState) string {
	if state.SupportModel != "" {
		return state.SupportModel
	}
	if h.cfg.SupportModel != "" {
		return h.cfg.SupportModel
	}
	if state.StoryModel != "" {
		return state.StoryModel
	}
	return h.cfg.StoryModel
}

// Generate handles story generation with SSE streaming.
func (h *Handlers) Generate(w http.ResponseWriter, r *http.Request) {
	var req GenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	state, err := h.store.Load()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Apply models from server config
	model := h.cfg.StoryModel
	if state.StoryModel != "" {
		model = state.StoryModel
	}

	// Prepend player action to story
	if req.Task == "action" && req.Action != "" {
		if strings.TrimSpace(state.Story) != "" {
			state.Story = strings.TrimSpace(state.Story) + "\n\n> " + req.Action
		} else {
			state.Story = "> " + req.Action
		}
	}

	prompt := game.BuildPrompt(state, req.Task, req.Action)
	maxTokens := game.MaxTokensForStyle(state.Style)

	// Set up SSE
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	ctx := r.Context()
	stops := []string{"# Ambient Outro"}

	result, err := h.client.CompleteStream(ctx, model, game.SystemPrompt, prompt, maxTokens, stops, func(accumulated string) error {
		cleaned := game.Clean(accumulated)
		data, _ := json.Marshal(map[string]string{"text": cleaned})
		fmt.Fprintf(w, "data: %s\n\n", data)
		flusher.Flush()
		return ctx.Err()
	})

	if err != nil {
		errData, _ := json.Marshal(map[string]string{"error": err.Error()})
		fmt.Fprintf(w, "data: %s\n\n", errData)
		flusher.Flush()
		return
	}

	// Clean final result and update story
	cleaned := game.Clean(result)
	if strings.TrimSpace(cleaned) != "" {
		state.Story = strings.TrimSpace(state.Story) + "\n\n" + strings.TrimSpace(cleaned)
	}

	// Save updated state
	if err := h.store.Save(state); err != nil {
		log.Printf("Failed to save state after generation: %v", err)
	}

	// Send final done event
	doneData, _ := json.Marshal(map[string]any{"done": true, "text": cleaned})
	fmt.Fprintf(w, "data: %s\n\n", doneData)
	flusher.Flush()
}

// Summarize compresses old story text into a memory entry.
func (h *Handlers) Summarize(w http.ResponseWriter, r *http.Request) {
	var req SummarizeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(req.Text) == "" {
		http.Error(w, "empty text", http.StatusBadRequest)
		return
	}

	state, err := h.store.Load()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	model := h.resolveSupportModel(state)

	systemPrompt := "You are a precise story summarizer."
	userPrompt := "Summarize (1/3 length). Preserve key facts. Past tense. ONLY the summary.\n\n" + req.Text
	if req.Condensed {
		systemPrompt = "You are a precise story summarizer. Condense multiple summaries into one cohesive overview."
		userPrompt = "Condense these summaries into a single cohesive summary (1/3 length). Preserve only the most important facts, characters, and events. Past tense. ONLY the summary.\n\n" + req.Text
	}

	summary, err := h.client.Complete(
		r.Context(),
		model,
		systemPrompt,
		userPrompt,
		1000,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"summary": game.Clean(summary)})
}

// UpdateStats asks the AI to update game state tracking sections.
func (h *Handlers) UpdateStats(w http.ResponseWriter, r *http.Request) {
	var req UpdateStatsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	if len(req.Sections) == 0 {
		http.Error(w, "no sections", http.StatusBadRequest)
		return
	}

	state, err := h.store.Load()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	model := h.resolveSupportModel(state)

	// Build the update prompt (same as prototype)
	var sb strings.Builder
	for i, s := range req.Sections {
		content := s.Content
		if content == "" {
			content = "(empty)"
		} else {
			content = `"` + strings.ReplaceAll(strings.ReplaceAll(content, `"`, `\"`), "\n", `\n`) + `"`
		}
		fmt.Fprintf(&sb, "%d. Name: \"%s\"\n   Desc: %s\n   Current: %s\n\n", i+1, s.Name, s.Description, content)
	}

	// Take last 3000 chars of story
	story := req.Story
	if len(story) > 3000 {
		story = story[len(story)-3000:]
	}

	prompt := fmt.Sprintf(
		"Tracking RPG state.\n\nCategories:\n\n%s\nRecent story:\n%s\n\nUpdate each. If empty, generate initial values.\n\nRespond ONLY JSON. Keys=exact names. Values=strings (\\n for newlines). No markdown.\nExample: {\"Stats\": \"Level: 1\\nHP: 100/100\"}",
		sb.String(), story,
	)

	raw, err := h.client.Complete(r.Context(), model, "You output only valid JSON.", prompt, 1000)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}

	// Strip markdown fences if present
	raw = strings.TrimSpace(raw)
	raw = strings.TrimPrefix(raw, "```json")
	raw = strings.TrimPrefix(raw, "```")
	raw = strings.TrimSuffix(raw, "```")
	raw = strings.TrimSpace(raw)

	var parsed map[string]string
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		http.Error(w, "AI returned invalid JSON: "+err.Error(), http.StatusBadGateway)
		return
	}

	// Apply updates to sections
	updated := make([]game.Section, len(req.Sections))
	for i, s := range req.Sections {
		updated[i] = s
		if v, ok := parsed[s.Name]; ok {
			updated[i].Content = strings.ReplaceAll(v, `\n`, "\n")
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"sections": updated})
}

type TransformRequest struct {
	Text        string `json:"text"`
	Instruction string `json:"instruction"`
}

// Transform applies an LLM-powered text transformation (fix, rewrite, etc.).
func (h *Handlers) Transform(w http.ResponseWriter, r *http.Request) {
	var req TransformRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	if req.Text == "" || req.Instruction == "" {
		http.Error(w, "text and instruction are required", http.StatusBadRequest)
		return
	}

	state, err := h.store.Load()
	if err != nil {
		state = &game.GameState{}
	}
	model := h.resolveSupportModel(state)

	system := "You are a text editor for a narrative story. Return ONLY the corrected or transformed text. Do not add explanations, notes, or commentary. Preserve the original tone and style."
	user := fmt.Sprintf("Instruction: %s\n\nText:\n%s", req.Instruction, req.Text)

	result, err := h.client.Complete(r.Context(), model, system, user, 2000)
	if err != nil {
		log.Printf("Transform error: %v", err)
		http.Error(w, "Transform failed: "+err.Error(), http.StatusBadGateway)
		return
	}

	result = strings.TrimSpace(result)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"text": result})
}
