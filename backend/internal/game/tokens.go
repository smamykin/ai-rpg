package game

// TokenCaps holds per-task max_token caps. Nil pointer = use the built-in default.
// A stored value of 0 = no cap (max_tokens omitted from the API request).
// Any positive value is sent as-is. ThinkingBonus is added on top of the base
// cap when reasoning effort is enabled.
type TokenCaps struct {
	StoryShort    *int `json:"storyShort,omitempty"`    // 1 sentence
	StoryMedium   *int `json:"storyMedium,omitempty"`   // 1 paragraph
	StoryLong     *int `json:"storyLong,omitempty"`     // 2-3 paragraphs
	StoryDetailed *int `json:"storyDetailed,omitempty"` // 3-4 detailed paragraphs
	Lore          *int `json:"lore,omitempty"`
	Summarize     *int `json:"summarize,omitempty"`
	UpdateStats   *int `json:"updateStats,omitempty"`
	Transform     *int `json:"transform,omitempty"`
	ImagePrompt   *int `json:"imagePrompt,omitempty"`
	Naming        *int `json:"naming,omitempty"`
	ThinkingBonus *int `json:"thinkingBonus,omitempty"`
}

// Built-in defaults used when a TokenCaps field is nil.
const (
	DefaultStoryShort    = 150
	DefaultStoryMedium   = 400
	DefaultStoryLong     = 800
	DefaultStoryDetailed = 1200
	DefaultLore          = 1200
	DefaultSummarize     = 1000
	DefaultUpdateStats   = 1000
	DefaultTransform     = 2000
	DefaultImagePrompt   = 500
	DefaultNaming        = 30
	DefaultThinkingBonus = 20000
)

// resolve returns the value behind the pointer, or fallback when nil.
func resolve(p *int, fallback int) int {
	if p == nil {
		return fallback
	}
	return *p
}

// applyThinking returns base + the thinking bonus when reasoning is active.
// A base of 0 (no cap) stays 0 — the bonus is meaningless without a cap.
func applyThinking(base int, thinkingActive bool, bonus int) int {
	if base == 0 || !thinkingActive {
		return base
	}
	return base + bonus
}

// MaxTokensForStyle returns the story max_tokens cap for the configured style,
// honoring the per-session override when set.
func (s *GameState) MaxTokensForStyle(style string) int {
	caps := s.tokenCaps()
	switch style {
	case "1 sentence":
		return resolve(caps.StoryShort, DefaultStoryShort)
	case "1 paragraph":
		return resolve(caps.StoryMedium, DefaultStoryMedium)
	case "2-3 paragraphs":
		return resolve(caps.StoryLong, DefaultStoryLong)
	case "3-4 detailed paragraphs":
		return resolve(caps.StoryDetailed, DefaultStoryDetailed)
	default:
		return resolve(caps.StoryMedium, DefaultStoryMedium)
	}
}

// TokenCap returns the configured cap (or built-in default) for a named role.
// Roles: "lore", "summarize", "updateStats", "transform", "imagePrompt", "naming".
func (s *GameState) TokenCap(role string) int {
	caps := s.tokenCaps()
	switch role {
	case "lore":
		return resolve(caps.Lore, DefaultLore)
	case "summarize":
		return resolve(caps.Summarize, DefaultSummarize)
	case "updateStats":
		return resolve(caps.UpdateStats, DefaultUpdateStats)
	case "transform":
		return resolve(caps.Transform, DefaultTransform)
	case "imagePrompt":
		return resolve(caps.ImagePrompt, DefaultImagePrompt)
	case "naming":
		return resolve(caps.Naming, DefaultNaming)
	}
	return 0
}

// ThinkingBonus returns the configured (or default) thinking bonus.
func (s *GameState) ThinkingBonus() int {
	return resolve(s.tokenCaps().ThinkingBonus, DefaultThinkingBonus)
}

// StoryCapForGen combines style cap + thinking bonus when reasoning is active.
func (s *GameState) StoryCapForGen(style string, thinkingActive bool) int {
	return applyThinking(s.MaxTokensForStyle(style), thinkingActive, s.ThinkingBonus())
}

// TokenCapForGen combines a role cap with the thinking bonus.
// Used when the call honors reasoning effort (currently only the story does).
// Support tasks should call TokenCap directly.
func (s *GameState) TokenCapForGen(role string, thinkingActive bool) int {
	return applyThinking(s.TokenCap(role), thinkingActive, s.ThinkingBonus())
}

// tokenCaps returns a non-nil TokenCaps to simplify lookups on a nil receiver
// or a state with no caps configured.
func (s *GameState) tokenCaps() *TokenCaps {
	if s == nil || s.TokenCaps == nil {
		return &TokenCaps{}
	}
	return s.TokenCaps
}
