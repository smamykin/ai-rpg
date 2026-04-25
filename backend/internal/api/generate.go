package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"ai-rpg-v2/internal/game"
	"ai-rpg-v2/internal/nanogpt"
)

type GenerateRequest struct {
	Task   string `json:"task"`   // "open", "action", "continue"
	Action string `json:"action"` // player's action text (for task="action")
	// Roll is the formatted dice text from this turn's variant (e.g.
	// "[Combat] dice 1(2d6) resulted 9"). Empty when the player didn't roll.
	Roll string `json:"roll,omitempty"`
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
// Tolerates a nil state (e.g. suggest-name called while on the hub with no current session).
func (h *Handlers) resolveSupportModel(state *game.GameState) string {
	if state != nil && state.SupportModel != "" {
		return state.SupportModel
	}
	if h.cfg.SupportModel != "" {
		return h.cfg.SupportModel
	}
	if state != nil && state.StoryModel != "" {
		return state.StoryModel
	}
	return h.cfg.StoryModel
}

// resolveModel picks the model for a task role, falling back through overrides → support → story.
// Known roles: summary, imagePrompt, loreGen, scenarioPolish, naming.
// Empty role or unknown role returns the support model.
func (h *Handlers) resolveModel(role string, state *game.GameState) string {
	if role != "" && state != nil && state.ModelRoles != nil {
		if v, ok := state.ModelRoles[role]; ok && v != "" {
			return v
		}
	}
	return h.resolveSupportModel(state)
}

// effortFor returns the reasoning_effort to send for a given task role.
// Only the story role honors the user's setting; all support tasks (summary,
// stats, transform, lore, image-prompt, naming) opt out so reasoning never
// leaks into structured outputs. For variants that bake reasoning in (the
// "-thinking" / ":thinking" suffix), we omit reasoning_effort=none so we don't
// fight the model's default depth — but still pass an explicit low/medium/high
// when the user picked one.
func (h *Handlers) effortFor(role string, state *game.GameState) string {
	if role != "story" || state == nil {
		return ""
	}
	e := state.ReasoningEffort
	if nanogpt.ReasoningEnforced(state.StoryModel) && (e == "" || e == "none") {
		return ""
	}
	return e
}

// thinkingActiveForStory returns true when the story call will produce
// reasoning tokens — either because the user enabled it or because the model
// variant always reasons. Used to decide whether to apply the thinking bonus
// to the output cap.
func (h *Handlers) thinkingActiveForStory(state *game.GameState) bool {
	if state == nil {
		return false
	}
	if nanogpt.ReasoningEnforced(state.StoryModel) {
		return true
	}
	e := state.ReasoningEffort
	return e != "" && e != "none"
}

// Generate handles story generation with SSE streaming.
func (h *Handlers) Generate(w http.ResponseWriter, r *http.Request) {
	curID := h.validateSession(w, r)
	if curID == "" {
		return
	}

	var req GenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	state, err := h.sessions.Get(curID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Apply models from server config
	model := h.cfg.StoryModel
	if state.StoryModel != "" {
		model = state.StoryModel
	}

	active := state.ActiveChapter()
	if active == nil {
		http.Error(w, "no active chapter", http.StatusInternalServerError)
		return
	}

	// For an action task, append the player's turn now so it's part of the prompt.
	// Open/continue don't create a turn yet — the prompt reflects existing state.
	// The stored action combines typed text and roll text so future turns see
	// the full record in <story_so_far>; the current-turn prompt below still
	// sends them separately for clean section formatting.
	if req.Task == "action" {
		if stored := game.CombineActionAndRoll(req.Action, req.Roll); stored != "" {
			active.AppendTurn(stored, "")
		}
	}

	prompt := game.BuildPrompt(state, req.Task, req.Action, req.Roll)
	effort := h.effortFor("story", state)
	maxTokens := state.StoryCapForGen(state.Style, h.thinkingActiveForStory(state))

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

	var lastReasoningLen int
	result, err := h.client.CompleteStream(ctx, model, game.SystemPrompt, prompt, maxTokens, effort, stops, func(content, reasoning string) error {
		// Emit reasoning event if it grew. We forward raw — no Clean() since
		// reasoning isn't user-facing narration.
		if len(reasoning) > lastReasoningLen {
			data, _ := json.Marshal(map[string]string{"reasoning": reasoning})
			fmt.Fprintf(w, "data: %s\n\n", data)
			lastReasoningLen = len(reasoning)
		}
		// Emit content event whenever the content total has anything (callback
		// fires only when *something* grew, so this captures the content side).
		cleaned := game.Clean(content)
		if cleaned != "" {
			data, _ := json.Marshal(map[string]string{"text": cleaned})
			fmt.Fprintf(w, "data: %s\n\n", data)
		}
		flusher.Flush()
		return ctx.Err()
	})

	if err != nil {
		errData, _ := json.Marshal(map[string]string{"error": err.Error()})
		fmt.Fprintf(w, "data: %s\n\n", errData)
		flusher.Flush()
		return
	}

	// Clean final result and write it into the active chapter's turn model.
	cleaned := strings.TrimSpace(game.Clean(result))
	if cleaned != "" {
		last := active.LastTurn()
		if last != nil && last.Response == "" {
			// Fill the response of the action turn (or an empty-action turn created
			// earlier in the session).
			last.Response = cleaned
		} else {
			// open/continue with no pending turn: create an opening-style turn.
			active.AppendTurn("", cleaned)
		}
	}

	// Only save if the current session still matches (user may have switched mid-generation).
	if cur, _ := h.sessions.GetCurrent(); cur == curID {
		if err := h.sessions.Save(curID, state); err != nil {
			log.Printf("Failed to save state after generation: %v", err)
		}
	}

	// Send final done event
	doneData, _ := json.Marshal(map[string]any{"done": true, "text": cleaned})
	fmt.Fprintf(w, "data: %s\n\n", doneData)
	flusher.Flush()
}

// Summarize compresses old story text into a memory entry.
func (h *Handlers) Summarize(w http.ResponseWriter, r *http.Request) {
	curID := h.validateSession(w, r)
	if curID == "" {
		return
	}

	var req SummarizeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(req.Text) == "" {
		http.Error(w, "empty text", http.StatusBadRequest)
		return
	}

	state, err := h.sessions.Get(curID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	model := h.resolveModel("summary", state)

	systemPrompt := game.SummarizeSystemPrompt
	userPrompt := game.SummarizeUserPrompt(req.Text)
	if req.Condensed {
		systemPrompt = game.CondenseSystemPrompt
		userPrompt = game.CondenseUserPrompt(req.Text)
	}

	summary, err := h.client.Complete(
		r.Context(),
		model,
		systemPrompt,
		userPrompt,
		state.TokenCap("summarize"),
		"",
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
	curID := h.validateSession(w, r)
	if curID == "" {
		return
	}

	var req UpdateStatsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	if len(req.Sections) == 0 {
		http.Error(w, "no sections", http.StatusBadRequest)
		return
	}

	state, err := h.sessions.Get(curID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	model := h.resolveSupportModel(state)

	// Build the categories block.
	var sb strings.Builder
	for i, s := range req.Sections {
		content := s.Content
		if content == "" {
			content = "(empty)"
		} else {
			content = `"` + strings.ReplaceAll(strings.ReplaceAll(content, `"`, `\"`), "\n", `\n`) + `"`
		}
		fmt.Fprintf(&sb, "%d. Name: \"%s\"\n   Description: %s\n   Current: %s\n\n", i+1, s.Name, s.Description, content)
	}

	// Take last 3000 chars of story
	story := req.Story
	if len(story) > 3000 {
		story = story[len(story)-3000:]
	}

	system := "You are a meticulous state tracker for a text-based RPG. You read the recent narrative and update tracked categories (stats, inventory, relationships, etc.) to reflect what has actually happened. Output valid JSON only — no prose, no markdown fences."

	prompt := fmt.Sprintf(
		"<categories>\n%s</categories>\n\n"+
			"<recent_story>\n%s\n</recent_story>\n\n"+
			"<instructions>\n"+
			"Update each category based on <recent_story>.\n"+
			"- Preserve existing values that the story does not contradict.\n"+
			"- Only change a value when the story supports the change.\n"+
			"- If Current is (empty), generate plausible initial values consistent with the story.\n"+
			"- Do not invent facts not present in the story or existing values.\n"+
			"</instructions>\n\n"+
			"<output_format>\n"+
			"Respond with ONLY a JSON object. Keys = exact category names. Values = strings (use \\n for newlines). No markdown fences, no commentary.\n"+
			"Example: {\"Stats\": \"Level: 1\\nHP: 100/100\"}\n"+
			"</output_format>",
		sb.String(), story,
	)

	raw, err := h.client.Complete(r.Context(), model, system, prompt, state.TokenCap("updateStats"), "")
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

// PromptPreview returns the assembled prompt (with per-section token estimates)
// without sending it to the model. Mirrors the mutation that Generate applies
// when task=action (appending the action to the active chapter) on an in-memory
// copy so the preview matches what Generate would build.
func (h *Handlers) PromptPreview(w http.ResponseWriter, r *http.Request) {
	curID := h.validateSession(w, r)
	if curID == "" {
		return
	}

	var req GenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	state, err := h.sessions.Get(curID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if req.Task == "action" {
		stored := game.CombineActionAndRoll(req.Action, req.Roll)
		if stored != "" {
			// Clone chapters (and the active chapter's turns slice) so the hypothetical
			// append doesn't leak into the stored state.
			chapters := make([]game.Chapter, len(state.Chapters))
			copy(chapters, state.Chapters)
			state.Chapters = chapters
			for i := range state.Chapters {
				if state.Chapters[i].ID == state.ActiveChapterID {
					turns := make([]game.Turn, len(state.Chapters[i].Turns))
					copy(turns, state.Chapters[i].Turns)
					state.Chapters[i].Turns = turns
					state.Chapters[i].AppendTurn(stored, "")
					break
				}
			}
		}
	}

	preview := game.BuildPromptPreview(state, req.Task, req.Action, req.Roll)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(preview)
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

	state, err := h.sessions.LoadCurrent()
	if err != nil {
		state = &game.GameState{}
	}
	model := h.resolveSupportModel(state)

	system := "You are a text editor for a narrative story. Return ONLY the transformed text — no preamble, no commentary, no wrapping quotes. Preserve the original tone and style. Do not extend or shorten the passage beyond what the instruction requires."
	user := fmt.Sprintf("<instruction>\n%s\n</instruction>\n\n<text>\n%s\n</text>", strings.TrimSpace(req.Instruction), req.Text)

	result, err := h.client.Complete(r.Context(), model, system, user, state.TokenCap("transform"), "")
	if err != nil {
		log.Printf("Transform error: %v", err)
		http.Error(w, "Transform failed: "+err.Error(), http.StatusBadGateway)
		return
	}

	result = strings.TrimSpace(result)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"text": result})
}
