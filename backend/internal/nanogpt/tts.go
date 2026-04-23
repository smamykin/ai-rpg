package nanogpt

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const TTSEndpoint = "https://nano-gpt.com/api/tts"

type TTSRequest struct {
	Model        string  `json:"model"`
	Text         string  `json:"text"`
	Voice        string  `json:"voice,omitempty"`
	Speed        float64 `json:"speed,omitempty"`
	Instructions string  `json:"instructions,omitempty"`
}

type ttsResponse struct {
	AudioURL string `json:"audioUrl"`
}

// TextToSpeech sends a TTS request to NanoGPT, fetches the resulting audio from audioUrl,
// and returns the raw audio bytes plus the Content-Type reported by the CDN.
func (c *Client) TextToSpeech(ctx context.Context, req TTSRequest) ([]byte, string, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, "", fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", TTSEndpoint, bytes.NewReader(body))
	if err != nil {
		return nil, "", fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", c.APIKey)
	httpReq.Header.Set("Authorization", "Bearer "+c.APIKey)

	ttsClient := &http.Client{Timeout: 120 * time.Second}
	resp, err := ttsClient.Do(httpReq)
	if err != nil {
		return nil, "", netErr("NanoGPT", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 1000))
		return nil, "", fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(b))
	}

	ct := resp.Header.Get("Content-Type")

	// OpenAI-family models return binary audio directly; others return JSON with audioUrl.
	if !strings.Contains(ct, "json") {
		data, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, "", fmt.Errorf("read audio: %w", err)
		}
		if ct == "" {
			ct = "audio/mpeg"
		}
		return data, ct, nil
	}

	var parsed ttsResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, "", fmt.Errorf("decode response: %w", err)
	}
	if parsed.AudioURL == "" {
		return nil, "", fmt.Errorf("empty audioUrl")
	}

	audioReq, err := http.NewRequestWithContext(ctx, "GET", parsed.AudioURL, nil)
	if err != nil {
		return nil, "", fmt.Errorf("create audio request: %w", err)
	}
	audioResp, err := ttsClient.Do(audioReq)
	if err != nil {
		return nil, "", netErr("audio CDN", err)
	}
	defer audioResp.Body.Close()

	if audioResp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("fetch audio HTTP %d", audioResp.StatusCode)
	}

	data, err := io.ReadAll(audioResp.Body)
	if err != nil {
		return nil, "", fmt.Errorf("read audio: %w", err)
	}

	contentType := audioResp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "audio/wav"
	}

	return data, contentType, nil
}
