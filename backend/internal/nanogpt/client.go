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
	BaseURL       = "https://nano-gpt.com/api/v1"
	ChatEndpoint  = BaseURL + "/chat/completions"
	ModelsEndpoint = BaseURL + "/models"
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
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
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
	ID      string  `json:"id"`
	Name    string  `json:"name,omitempty"`
	Ctx     int      `json:"ctx"`
	Price   *float64 `json:"price"`
}

// Complete sends a non-streaming chat completion request.
func (c *Client) Complete(ctx context.Context, model, system, user string, maxTokens int) (string, error) {
	req := ChatRequest{
		Model:     model,
		MaxTokens: maxTokens,
		Stream:    false,
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

// StreamCallback is called for each accumulated chunk of streamed text.
type StreamCallback func(accumulated string) error

// CompleteStream sends a streaming chat completion and calls onChunk with accumulated text.
// It returns the final full text.
func (c *Client) CompleteStream(ctx context.Context, model, system, user string, maxTokens int, stops []string, onChunk StreamCallback) (string, error) {
	req := ChatRequest{
		Model:     model,
		MaxTokens: maxTokens,
		Stream:    true,
		Stop:      stops,
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
	var full strings.Builder

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

		if len(chunk.Choices) > 0 && chunk.Choices[0].Delta != nil {
			delta := chunk.Choices[0].Delta.Content
			if delta != "" {
				full.WriteString(delta)

				// Check for ambient outro marker
				if strings.Contains(full.String(), "# Ambient Outro") {
					text := strings.Split(full.String(), "# Ambient Outro")[0]
					return text, nil
				}

				if onChunk != nil {
					if err := onChunk(full.String()); err != nil {
						return full.String(), err
					}
				}
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
			ID:   m.ID,
			Name: m.Name,
			Ctx:  m.ContextLength,
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
