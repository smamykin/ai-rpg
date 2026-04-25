package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

type GenerateImageRequest struct {
	Model      string `json:"model"`
	Prompt     string `json:"prompt"`
	N          int    `json:"n"`
	Resolution string `json:"resolution"`
}

type EnhancePromptRequest struct {
	Instructions string               `json:"instructions"`
	Context      EnhancePromptContext  `json:"context"`
}

type EnhancePromptContext struct {
	RecentStory string              `json:"recentStory,omitempty"`
	Summaries   string              `json:"summaries,omitempty"`
	Overview    string              `json:"overview,omitempty"`
	ImageStyle  string              `json:"imageStyle,omitempty"`
	LoreEntries []LoreEntryContext  `json:"loreEntries,omitempty"`
}

type LoreEntryContext struct {
	Name string `json:"name"`
	Text string `json:"text"`
}

// GetImageModels returns available image models from NanoGPT.
func (h *Handlers) GetImageModels(w http.ResponseWriter, r *http.Request) {
	models, err := h.client.FetchImageModels(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"models": models})
}

// GenerateImages generates images via NanoGPT.
func (h *Handlers) GenerateImages(w http.ResponseWriter, r *http.Request) {
	var req GenerateImageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	if req.Model == "" || req.Prompt == "" {
		http.Error(w, "model and prompt are required", http.StatusBadRequest)
		return
	}
	if req.N < 1 {
		req.N = 1
	}
	if strings.TrimSpace(req.Resolution) == "" {
		req.Resolution = "1024x1024"
	}

	results, err := h.client.GenerateImage(r.Context(), req.Model, req.Prompt, req.N, req.Resolution)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}

	type imageOut struct {
		URL string `json:"url"`
	}
	images := make([]imageOut, 0, len(results))
	for _, res := range results {
		u := res.URL
		if u == "" && res.B64JSON != "" {
			u = "data:image/png;base64," + res.B64JSON
		}
		if u != "" {
			images = append(images, imageOut{URL: u})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"images": images})
}

// EnhanceImagePrompt uses AI to generate an image prompt from instructions and context.
func (h *Handlers) EnhanceImagePrompt(w http.ResponseWriter, r *http.Request) {
	var req EnhancePromptRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(req.Instructions) == "" {
		http.Error(w, "instructions required", http.StatusBadRequest)
		return
	}

	// Tolerate no current session — image-prompt generation may run from scenario authoring.
	state, _ := h.sessions.LoadCurrent()
	model := h.resolveModel("imagePrompt", state)

	systemPrompt := `You are an expert prompt engineer for text-to-image models, working on RPG illustration. Given the user's <instructions> plus optional context (<overview>, <story_summaries>, <recent_story>, <lore>, <image_style>), produce a single image generation prompt.

CRITICAL: the image model knows NOTHING about this story, world, characters, or past events. It only sees the prompt you write. Treat the reader as someone who has never heard of any character, place, faction, or item. Every visual fact must be stated explicitly in the prompt itself.

Hard rules:
- Output ONLY the prompt text — no preamble, no quotes, no labels, no explanation.
- NO proper names of people, places, factions, items, or events. Replace each name with its concrete visual description, sourced from <lore>, <overview>, <story_summaries>, or <recent_story>. Example: instead of "Kael at the Ember Gate", write "a tall lean man with short black hair and a scarred jaw in a dark leather coat, standing before a tall iron archway lit by hanging braziers".
- If a name appears in <instructions> but is not described anywhere in the context blocks, invent a plausible, genre-appropriate visual description for it — never leave it as a name.
- Describe ONLY what is visible in the frame. Allowed: subject(s) with concrete visual traits (gender, build, approximate age, skin tone, hair, clothing, weapons, posture, facial expression), setting (architecture, terrain, props, weather, time of day), action/pose, framing and camera angle, lighting (source, direction, color, intensity), color palette, materials and textures.
- Forbidden: abstract or narrative words ("mysterious", "ancient power", "tragic", "destiny", "fateful", "important", "the protagonist", "our hero"), references to plot, backstory, motivations, emotions that can't be shown on a face, or anything the eye cannot directly see.
- If <image_style> is provided, treat it as a binding art-direction constraint and embed its medium, palette, rendering, and aesthetic vocabulary in the prompt.
- Prefer dense, specific visual detail over flowery prose. Short comma-separated clauses are fine — many image models parse them well.
- Keep the prompt under 150 words.`

	var sb strings.Builder

	if req.Context.ImageStyle != "" {
		fmt.Fprintf(&sb, "<image_style>\n%s\n</image_style>\n\n", req.Context.ImageStyle)
	}
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
		sb.WriteString("<lore>\n")
		for _, l := range req.Context.LoreEntries {
			fmt.Fprintf(&sb, "**%s**: %s\n", l.Name, l.Text)
		}
		sb.WriteString("</lore>\n\n")
	}

	fmt.Fprintf(&sb, "<instructions>\n%s\n</instructions>\n", strings.TrimSpace(req.Instructions))

	result, err := h.client.Complete(r.Context(), model, systemPrompt, sb.String(), state.TokenCap("imagePrompt"), "")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"prompt": strings.TrimSpace(result)})
}
