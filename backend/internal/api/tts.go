package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"ai-rpg-v2/internal/nanogpt"
)

type TTSRequestBody struct {
	Text         string  `json:"text"`
	Model        string  `json:"model"`
	Voice        string  `json:"voice"`
	Speed        float64 `json:"speed"`
	Instructions string  `json:"instructions"`
}

// defaultVoiceFor returns a sensible default voice for a given TTS model.
func defaultVoiceFor(model string) string {
	switch model {
	case "Kokoro-82m":
		return "af_bella"
	case "gemini-2.5-flash-preview-tts":
		return "Kore"
	default:
		// OpenAI family (gpt-4o-mini-tts, tts-1, tts-1-hd)
		return "nova"
	}
}

// TextToSpeech handles a TTS request: forwards to NanoGPT and streams the audio bytes back.
func (h *Handlers) TextToSpeech(w http.ResponseWriter, r *http.Request) {
	var req TTSRequestBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.Text) == "" {
		http.Error(w, "text is required", http.StatusBadRequest)
		return
	}
	if req.Model == "" {
		req.Model = "Kokoro-82m"
	}
	if req.Voice == "" {
		req.Voice = defaultVoiceFor(req.Model)
	}
	if req.Speed == 0 {
		req.Speed = 1.0
	}

	audio, contentType, err := h.client.TextToSpeech(r.Context(), nanogpt.TTSRequest{
		Model:        req.Model,
		Text:         req.Text,
		Voice:        req.Voice,
		Speed:        req.Speed,
		Instructions: req.Instructions,
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "no-store")
	w.Write(audio)
}
