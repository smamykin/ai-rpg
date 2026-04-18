package game

import "strings"

// GameState holds the full game state.
type GameState struct {
	Story        string      `json:"story"`
	Overview     string      `json:"overview"`
	Style        string      `json:"style"`
	CStyle       string      `json:"cStyle"`
	StoryModel   string      `json:"storyModel"`
	SupportModel string      `json:"supportModel"`
	Arc          string      `json:"arc"`
	Diff         string      `json:"diff"`
	Summaries    []Summary   `json:"summaries"`
	Lore         []LoreEntry `json:"lore"`
	SumUpTo      int         `json:"sumUpTo"`
	AutoSum      bool        `json:"autoSum"`
	AutoAccept   bool        `json:"autoAccept"`
	SumThreshold int         `json:"sumThreshold"`
	Secs         []Section   `json:"secs"`
	AuFreq       int         `json:"auFreq"`
	Format       string      `json:"format,omitempty"`

	// Legacy fields — consumed during migration, omitted after.
	Mems    []Memory `json:"mems,omitempty"`
	AddlMem string   `json:"addlMem,omitempty"`
}

type Summary struct {
	ID        string `json:"id"`
	Text      string `json:"text"`
	Tier      string `json:"tier"`      // "recent" or "ancient"
	CharRange [2]int `json:"charRange"` // [fromChar, toChar] of story text summarized
	CreatedAt int64  `json:"createdAt"`
}

type LoreEntry struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Text    string `json:"text"`
	Tag     string `json:"tag"` // "world", "character", "rule", "quest", "other"
	Enabled bool   `json:"enabled"`
}

// Legacy type kept for migration deserialization.
type Memory struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}

type Section struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Content     string `json:"content"`
}

// Migrate converts legacy fields to the new format. Returns true if changes were made.
func (s *GameState) Migrate() bool {
	changed := false

	// Migrate old mems[] -> summaries[]
	if len(s.Mems) > 0 && len(s.Summaries) == 0 {
		for _, m := range s.Mems {
			if strings.TrimSpace(m.Text) == "" {
				continue
			}
			s.Summaries = append(s.Summaries, Summary{
				ID:        m.ID,
				Text:      m.Text,
				Tier:      "recent",
				CharRange: [2]int{0, 0},
			})
		}
		s.Mems = nil
		changed = true
	}

	// Migrate addlMem blob -> single lore entry
	if strings.TrimSpace(s.AddlMem) != "" && len(s.Lore) == 0 {
		s.Lore = append(s.Lore, LoreEntry{
			ID:      "migrated_addlmem",
			Name:    "Notes",
			Text:    s.AddlMem,
			Tag:     "world",
			Enabled: true,
		})
		s.AddlMem = ""
		changed = true
	}

	// Ensure slices are non-nil
	if s.Summaries == nil {
		s.Summaries = []Summary{}
		changed = true
	}
	if s.Lore == nil {
		s.Lore = []LoreEntry{}
		changed = true
	}

	// Update format version
	if s.Format != "ai-rpg-nano-v2" {
		s.Format = "ai-rpg-nano-v2"
		changed = true
	}

	return changed
}

func DefaultState() *GameState {
	return &GameState{
		Style:     "1 paragraph",
		Diff:      "normal",
		Summaries:    []Summary{},
		Lore:         []LoreEntry{},
		SumThreshold: 2500,
		Secs:         []Section{},
		Format:       "ai-rpg-nano-v2",
	}
}
