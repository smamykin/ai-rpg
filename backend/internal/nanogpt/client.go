package nanogpt

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	BaseURL              = "https://nano-gpt.com/api/v1"
	ChatEndpoint         = BaseURL + "/chat/completions"
	ModelsEndpoint       = BaseURL + "/models"
	ImageEndpoint        = "https://nano-gpt.com/v1/images/generations"
	ImageModelsEndpoint  = BaseURL + "/image-models"
)

type Client struct {
	APIKey     string
	HTTPClient *http.Client
}

func NewClient(apiKey string) *Client {
	return &Client{
		APIKey: apiKey,
		HTTPClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

type ChatRequest struct {
	Model    string    `json:"model"`
	Messages []Message `json:"messages"`
	MaxTokens int     `json:"max_tokens"`
	Stream   bool      `json:"stream"`
	Stop     []string  `json:"stop,omitempty"`
	ReasoningEffort string `json:"reasoning_effort,omitempty"`
}

type Message struct {
	Role      string `json:"role"`
	Content   string `json:"content"`
	Reasoning string `json:"reasoning,omitempty"`
}

type ChatResponse struct {
	Choices []Choice `json:"choices"`
}

type Choice struct {
	Message      *Message      `json:"message,omitempty"`
	Delta        *Message      `json:"delta,omitempty"`
	FinishReason string        `json:"finish_reason,omitempty"`
}

type Model struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	ContextLength int   `json:"context_length"`
	PricePrompt  *float64 `json:"pricePrompt,omitempty"`
}

type ModelResponse struct {
	ID               string   `json:"id"`
	Name             string   `json:"name,omitempty"`
	Ctx              int      `json:"ctx"`
	Price            *float64 `json:"price"`
	SupportsThinking bool     `json:"supportsThinking"`
}

// DetectsThinking returns true if the model ID matches a known reasoning-capable
// pattern. Mirrors the heuristic in frontend/src/types.ts (detectThinkingModel).
func DetectsThinking(modelID string) bool {
	s := strings.ToLower(modelID)
	patterns := []string{
		"gpt-5", "o1-", "o3-", "o4-",
		":thinking", "-thinking",
		"deepseek-r1", "qwen3-thinking", "grok-4-reasoning",
	}
	for _, p := range patterns {
		if strings.Contains(s, p) {
			return true
		}
	}
	return false
}

// Image generation types.

type ImageModel struct {
	ID   string `json:"id"`
	Name string `json:"name,omitempty"`
}

type ImageResult struct {
	URL     string `json:"url,omitempty"`
	B64JSON string `json:"b64_json,omitempty"`
}

// GenerateImage sends an image generation request to NanoGPT.
func (c *Client) GenerateImage(ctx context.Context, model, prompt string, n, width, height int) ([]ImageResult, error) {
	// Build request body — gpt-image models use different fields
	var body map[string]any
	if strings.HasPrefix(model, "gpt-image") {
		body = map[string]any{
			"model":      model,
			"prompt":     prompt,
			"quality":    "low",
			"resolution": fmt.Sprintf("%dx%d", width, height),
			"nImages":    n,
		}
	} else {
		body = map[string]any{
			"model":           model,
			"prompt":          prompt,
			"n":               n,
			"size":            fmt.Sprintf("%dx%d", width, height),
			"response_format": "url",
		}
	}

	data, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", ImageEndpoint, bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.APIKey)

	imgClient := &http.Client{Timeout: 120 * time.Second}
	resp, err := imgClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 500))
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(b))
	}

	var raw struct {
		Data []ImageResult `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	if len(raw.Data) == 0 {
		return nil, fmt.Errorf("no images returned")
	}
	return raw.Data, nil
}

// FetchImageModels retrieves the list of available image models.
func (c *Client) FetchImageModels(ctx context.Context) ([]ImageModel, error) {
	httpReq, err := http.NewRequestWithContext(ctx, "GET", ImageModelsEndpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	var raw struct {
		Data []json.RawMessage `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("decode: %w", err)
	}

	models := make([]ImageModel, 0, len(raw.Data))
	for _, d := range raw.Data {
		// Models can be objects or plain strings
		var m ImageModel
		if err := json.Unmarshal(d, &m); err == nil && m.ID != "" {
			models = append(models, m)
			continue
		}
		var s string
		if err := json.Unmarshal(d, &s); err == nil && s != "" {
			models = append(models, ImageModel{ID: s, Name: s})
		}
	}
	return models, nil
}

// Complete sends a non-streaming chat completion request. Pass effort="" (or "none")
// to disable reasoning; any other value enables thinking on capable models. Reasoning
// content from the response is discarded — only the answer text is returned.
func (c *Client) Complete(ctx context.Context, model, system, user string, maxTokens int, effort string) (string, error) {
	req := ChatRequest{
		Model:     model,
		MaxTokens: maxTokens,
		Stream:    false,
		ReasoningEffort: effort,
		Messages: []Message{
			{Role: "system", Content: system},
			{Role: "user", Content: user},
		},
	}

	body, err := json.Marshal(req)
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", ChatEndpoint, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.APIKey)

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 500))
		return "", fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(b))
	}

	var chatResp ChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&chatResp); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}

	if len(chatResp.Choices) == 0 || chatResp.Choices[0].Message == nil {
		return "", fmt.Errorf("empty response")
	}
	return chatResp.Choices[0].Message.Content, nil
}

// StreamCallback is called whenever the running content or reasoning total grows.
// Both args are running totals; either may be empty on a given tick.
type StreamCallback func(content, reasoning string) error

// CompleteStream sends a streaming chat completion and calls onChunk with the
// accumulated content and reasoning totals. Returns the final full content text
// (reasoning is delivered to the callback only, not returned).
func (c *Client) CompleteStream(ctx context.Context, model, system, user string, maxTokens int, effort string, stops []string, onChunk StreamCallback) (string, error) {
	req := ChatRequest{
		Model:     model,
		MaxTokens: maxTokens,
		Stream:    true,
		Stop:      stops,
		ReasoningEffort: effort,
		Messages: []Message{
			{Role: "system", Content: system},
			{Role: "user", Content: user},
		},
	}

	body, err := json.Marshal(req)
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	// No timeout for streaming — use context for cancellation
	httpClient := &http.Client{}
	httpReq, err := http.NewRequestWithContext(ctx, "POST", ChatEndpoint, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.APIKey)
	httpReq.Header.Set("Accept", "text/event-stream")

	resp, err := httpClient.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 500))
		return "", fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(b))
	}

	scanner := bufio.NewScanner(resp.Body)
	// Default scanner buffer is 64KB; reasoning chunks can occasionally exceed that.
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	var full strings.Builder
	var reasoning strings.Builder

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(line[5:])
		if data == "" || data == "[DONE]" {
			continue
		}

		var chunk ChatResponse
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}

		if len(chunk.Choices) == 0 || chunk.Choices[0].Delta == nil {
			continue
		}
		delta := chunk.Choices[0].Delta
		grew := false
		if delta.Reasoning != "" {
			reasoning.WriteString(delta.Reasoning)
			grew = true
		}
		if delta.Content != "" {
			full.WriteString(delta.Content)
			grew = true

			// Check for ambient outro marker (content only).
			if strings.Contains(full.String(), "# Ambient Outro") {
				text := strings.Split(full.String(), "# Ambient Outro")[0]
				return text, nil
			}
		}
		if grew && onChunk != nil {
			if err := onChunk(full.String(), reasoning.String()); err != nil {
				return full.String(), err
			}
		}
	}

	if err := scanner.Err(); err != nil {
		if full.Len() > 0 {
			return full.String(), nil
		}
		return "", fmt.Errorf("stream read: %w", err)
	}

	return full.String(), nil
}

// FetchModels retrieves the list of available models.
func (c *Client) FetchModels(ctx context.Context) ([]ModelResponse, error) {
	httpReq, err := http.NewRequestWithContext(ctx, "GET", ModelsEndpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	if c.APIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+c.APIKey)
	}

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	var raw struct {
		Data []struct {
			ID                   string  `json:"id"`
			Name                 string  `json:"name"`
			ContextLength        int     `json:"context_length"`
			InputPricePerMillion float64 `json:"input_price_per_million"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("decode: %w", err)
	}

	models := make([]ModelResponse, 0, len(raw.Data))
	for _, m := range raw.Data {
		mr := ModelResponse{
			ID:               m.ID,
			Name:             m.Name,
			Ctx:              m.ContextLength,
			SupportsThinking: DetectsThinking(m.ID),
		}
		if mr.Name == "" {
			mr.Name = m.ID
		}
		if m.InputPricePerMillion > 0 {
			p := m.InputPricePerMillion
			mr.Price = &p
		}
		models = append(models, mr)
	}
	return models, nil
}
