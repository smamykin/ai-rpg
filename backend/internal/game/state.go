package game

import (
	"fmt"
	"log"
	"time"
)

const FormatV5 = "ai-rpg-nano-v5" // chapters model

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
	StoryModel   string      `json:"storyModel"`
	SupportModel string      `json:"supportModel"`
	Arc          string      `json:"arc"`
	Diff         string      `json:"diff"`
	Lore         []LoreEntry `json:"lore"`
	Secs         []Section   `json:"secs"`
	AuFreq       int         `json:"auFreq"`
	TTS          TTSSettings `json:"tts"`

	// Chapters (v5)
	Chapters         []Chapter `json:"chapters"`
	ActiveChapterID  string    `json:"activeChapterId,omitempty"`
	ViewingChapterID string    `json:"viewingChapterId,omitempty"`
	ArchivedChapters []Chapter `json:"archivedChapters,omitempty"`

	// Context budget (v5)
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

// Chapter represents a single narrative unit — either a leaf chapter with content,
// or an act grouping multiple closed chapters under one condensed summary.
type Chapter struct {
	ID           string   `json:"id"`
	Title        string   `json:"title"`
	Content      string   `json:"content"`            // empty for acts
	Summary      string   `json:"summary"`            // empty while active
	Status       string   `json:"status"`             // "active" | "closed" | "act"
	Children     []string `json:"children,omitempty"` // chapter IDs — only on acts
	SummaryStale bool     `json:"summaryStale,omitempty"`
	CreatedAt    int64    `json:"createdAt"`
}

type LoreEntry struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Text    string `json:"text"`
	Tag     string `json:"tag"` // "world", "character", "rule", "quest", "other"
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

// Migrate brings state to the current format. For pre-v5 states, it wipes any play
// progress (story, summaries) while preserving session metadata and setup (lore,
// overview, sections, TTS). Returns true if the state was mutated.
//
// TODO: remove the pre-v5 wipe branch once no users are on older formats (after 2026-06).
func (s *GameState) Migrate() bool {
	changed := false

	if s.Format != FormatV5 {
		// Legacy formats carried arbitrary play-progress fields we've since removed.
		// encoding/json has already silently dropped them during Unmarshal; here we
		// just reset the chapters structure so the session starts clean.
		s.Chapters = nil
		s.ActiveChapterID = ""
		s.ViewingChapterID = ""
		s.ArchivedChapters = nil
		if s.Format != "" {
			log.Printf("migrated session %q from format %q to %q (play progress wiped, setup preserved)", s.SessionID, s.Format, FormatV5)
		}
		s.Format = FormatV5
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

// TotalContentChars sums the content length across all chapters (for session metadata).
func (s *GameState) TotalContentChars() int {
	total := 0
	for _, c := range s.Chapters {
		total += len(c.Content)
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
		Format:             FormatV5,
	}
	s.ensureActiveChapter()
	s.ViewingChapterID = s.ActiveChapterID
	return s
}
