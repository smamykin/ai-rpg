package game

import (
	"fmt"
	"log"
	"strings"
	"time"
)

const FormatV6 = "ai-rpg-nano-v6" // chapters + turns model

// GameState holds the full game state.
type GameState struct {
	// Session metadata
	SessionID    string            `json:"sessionId,omitempty"`
	Name         string            `json:"name,omitempty"`
	CreatedAt    int64             `json:"createdAt,omitempty"`
	LastPlayedAt int64             `json:"lastPlayedAt,omitempty"`
	ModelRoles   map[string]string `json:"modelRoles,omitempty"`

	// Setup & config (carried across format upgrades)
	Overview     string      `json:"overview"`
	Style        string      `json:"style"`
	CStyle       string      `json:"cStyle"`
	StoryModel      string   `json:"storyModel"`
	SupportModel    string   `json:"supportModel"`
	ReasoningEffort string   `json:"reasoningEffort,omitempty"`
	Arc             string   `json:"arc"`
	Diff         string      `json:"diff"`
	Lore         []LoreEntry `json:"lore"`
	Secs         []Section   `json:"secs"`
	AuFreq       int         `json:"auFreq"`
	TTS          TTSSettings `json:"tts"`

	// Chapters (v6)
	Chapters         []Chapter `json:"chapters"`
	ActiveChapterID  string    `json:"activeChapterId,omitempty"`
	ViewingChapterID string    `json:"viewingChapterId,omitempty"`
	ArchivedChapters []Chapter `json:"archivedChapters,omitempty"`

	// Context budget (v5+)
	EffectiveCtxTokens int `json:"effectiveCtxTokens,omitempty"`

	Format string `json:"format,omitempty"`
}

type TTSSettings struct {
	AutoPlay    bool                        `json:"autoPlay"`
	ActiveModel string                      `json:"activeModel,omitempty"`
	PerModel    map[string]TTSModelSettings `json:"perModel,omitempty"`
}

type TTSModelSettings struct {
	Voice         string  `json:"voice,omitempty"`
	Speed         float64 `json:"speed,omitempty"`
	Instructions  string  `json:"instructions,omitempty"`
	DialogueVoice string  `json:"dialogueVoice,omitempty"`
}

// Turn is a single player-action/AI-response pair inside a chapter.
// An opening turn (chapter start or a "continue" generation with no preceding action)
// has an empty Action.
type Turn struct {
	ID        string `json:"id"`
	Action    string `json:"action,omitempty"`
	Response  string `json:"response"`
	CreatedAt int64  `json:"createdAt,omitempty"`
}

// Chapter represents a single narrative unit — either a leaf chapter with turns,
// or an act grouping multiple closed chapters under one condensed summary.
type Chapter struct {
	ID           string   `json:"id"`
	Title        string   `json:"title"`
	Turns        []Turn   `json:"turns"`              // empty for acts
	Summary      string   `json:"summary"`            // empty while active
	Status       string   `json:"status"`             // "active" | "closed" | "act"
	Children     []string `json:"children,omitempty"` // chapter IDs — only on acts
	SummaryStale bool     `json:"summaryStale,omitempty"`
	CreatedAt    int64    `json:"createdAt"`
}

// RenderedContent reconstructs the legacy ">-action / \n\n / response" string
// form from the chapter's turns. Used by prompt building, summarization, export.
func (c *Chapter) RenderedContent() string {
	var b strings.Builder
	for i, t := range c.Turns {
		if i > 0 {
			b.WriteString("\n\n")
		}
		if t.Action != "" {
			b.WriteString("> ")
			b.WriteString(t.Action)
			if t.Response != "" {
				b.WriteString("\n\n")
				b.WriteString(t.Response)
			}
		} else {
			b.WriteString(t.Response)
		}
	}
	return b.String()
}

// AppendTurn appends a new turn with the given action (response will be filled by streaming).
func (c *Chapter) AppendTurn(action, response string) *Turn {
	c.Turns = append(c.Turns, Turn{
		ID:        fmt.Sprintf("t_%d", time.Now().UnixNano()),
		Action:    action,
		Response:  response,
		CreatedAt: time.Now().Unix(),
	})
	return &c.Turns[len(c.Turns)-1]
}

// LastTurn returns a pointer to the last turn, or nil if there are none.
func (c *Chapter) LastTurn() *Turn {
	if len(c.Turns) == 0 {
		return nil
	}
	return &c.Turns[len(c.Turns)-1]
}

type LoreEntry struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Text    string `json:"text"`
	Tag     string `json:"tag"` // "world", "character", "rule", "quest", "item", "creature", "other"
	Enabled bool   `json:"enabled"`
}

type Section struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Content     string `json:"content"`
}

// Scenario is a reusable session template (overview + style + lore + sections).
type Scenario struct {
	ID          string      `json:"id"`
	Name        string      `json:"name"`
	Description string      `json:"description"`
	Overview    string      `json:"overview"`
	CStyle      string      `json:"cStyle"`
	Style       string      `json:"style"`
	Diff        string      `json:"diff"`
	Lore        []LoreEntry `json:"lore"`
	Secs        []Section   `json:"secs"`
	CreatedAt   int64       `json:"createdAt"`
	UpdatedAt   int64       `json:"updatedAt"`
}

// Migrate brings state to the current format. For any pre-V6 session, it wipes
// play progress (chapters) while preserving session metadata and setup (lore,
// overview, sections, TTS). An empty format (frontend PUT that didn't echo it)
// is treated as current so play progress survives. Returns true if mutated.
func (s *GameState) Migrate() bool {
	changed := false

	if s.Format != "" && s.Format != FormatV6 {
		// Known non-V6 format: wipe chapters so play starts clean. Setup is preserved.
		s.Chapters = nil
		s.ActiveChapterID = ""
		s.ViewingChapterID = ""
		s.ArchivedChapters = nil
		log.Printf("migrated session %q from format %q to %q (play progress wiped, setup preserved)", s.SessionID, s.Format, FormatV6)
		s.Format = FormatV6
		changed = true
	} else if s.Format == "" {
		s.Format = FormatV6
		changed = true
	}

	// Invariants
	if s.Chapters == nil {
		s.Chapters = []Chapter{}
		changed = true
	}
	if s.Lore == nil {
		s.Lore = []LoreEntry{}
		changed = true
	}
	if s.Secs == nil {
		s.Secs = []Section{}
		changed = true
	}
	if s.ModelRoles == nil {
		s.ModelRoles = map[string]string{}
		changed = true
	}
	if s.Name == "" {
		s.Name = "Adventure"
		changed = true
	}
	if s.EffectiveCtxTokens == 0 {
		s.EffectiveCtxTokens = 32000
		changed = true
	}
	// Ensure each chapter has a non-nil Turns slice (so JSON emits [] not null).
	for i := range s.Chapters {
		if s.Chapters[i].Turns == nil {
			s.Chapters[i].Turns = []Turn{}
			changed = true
		}
	}
	for i := range s.ArchivedChapters {
		if s.ArchivedChapters[i].Turns == nil {
			s.ArchivedChapters[i].Turns = []Turn{}
			changed = true
		}
	}
	if s.ensureActiveChapter() {
		changed = true
	}
	if s.ViewingChapterID == "" && s.ActiveChapterID != "" {
		s.ViewingChapterID = s.ActiveChapterID
		changed = true
	}

	return changed
}

// ensureActiveChapter guarantees exactly one chapter with status "active".
// If none exists, appends a blank one and sets ActiveChapterID.
func (s *GameState) ensureActiveChapter() bool {
	for _, c := range s.Chapters {
		if c.Status == "active" {
			if s.ActiveChapterID != c.ID {
				s.ActiveChapterID = c.ID
				return true
			}
			return false
		}
	}
	id := fmt.Sprintf("ch_%d", time.Now().UnixNano())
	s.Chapters = append(s.Chapters, Chapter{
		ID:        id,
		Title:     "",
		Turns:     []Turn{},
		Status:    "active",
		CreatedAt: time.Now().Unix(),
	})
	s.ActiveChapterID = id
	return true
}

// ActiveChapter returns the active chapter, or nil if none (should not happen after Migrate).
func (s *GameState) ActiveChapter() *Chapter {
	for i := range s.Chapters {
		if s.Chapters[i].ID == s.ActiveChapterID {
			return &s.Chapters[i]
		}
	}
	return nil
}

// TotalContentChars sums the rendered content length across all chapters (for session metadata).
func (s *GameState) TotalContentChars() int {
	total := 0
	for i := range s.Chapters {
		total += len(s.Chapters[i].RenderedContent())
	}
	return total
}

func DefaultState() *GameState {
	now := time.Now().Unix()
	s := &GameState{
		Name:               "Adventure",
		CreatedAt:          now,
		LastPlayedAt:       now,
		ModelRoles:         map[string]string{},
		Style:              "1 paragraph",
		Diff:               "normal",
		Lore:               []LoreEntry{},
		Secs:               []Section{},
		Chapters:           []Chapter{},
		EffectiveCtxTokens: 32000,
		Format:             FormatV6,
	}
	s.ensureActiveChapter()
	s.ViewingChapterID = s.ActiveChapterID
	return s
}
