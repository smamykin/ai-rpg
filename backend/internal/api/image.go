package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

type GenerateImageRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
	N      int    `json:"n"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
}

type EnhancePromptRequest struct {
	Instructions string               `json:"instructions"`
	Context      EnhancePromptContext  `json:"context"`
}

type EnhancePromptContext struct {
	RecentStory string              `json:"recentStory,omitempty"`
	Summaries   string              `json:"summaries,omitempty"`
	Overview    string              `json:"overview,omitempty"`
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
	if req.Width < 1 {
		req.Width = 1024
	}
	if req.Height < 1 {
		req.Height = 1024
	}

	results, err := h.client.GenerateImage(r.Context(), req.Model, req.Prompt, req.N, req.Width, req.Height)
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

	systemPrompt := `You are an expert AI image prompt engineer for RPG illustration. Given the user's <instructions> plus optional context (<overview>, <story_summaries>, <recent_story>, <lore>), produce a single vivid image generation prompt.

Rules:
- Output ONLY the prompt text, nothing else.
- Be descriptive: include lighting, mood, style, composition, colors, textures.
- Be creative and add artistic details that fit the RPG setting.
- Keep the prompt under 200 words.`

	var sb strings.Builder

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

	result, err := h.client.Complete(r.Context(), model, systemPrompt, sb.String(), 500, "")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"prompt": strings.TrimSpace(result)})
}
