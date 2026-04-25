package game

import (
	"fmt"
	"log"
	"regexp"
	"strconv"
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
	ImgStyle     string      `json:"imgStyle,omitempty"`
	StoryModel      string   `json:"storyModel"`
	SupportModel    string   `json:"supportModel"`
	ReasoningEffort string   `json:"reasoningEffort,omitempty"`
	Arc             string   `json:"arc"`
	Diff         string      `json:"diff"`
	Lore              []LoreEntry   `json:"lore"`
	Secs              []Section     `json:"secs"`
	Notes             []Note        `json:"notes"`
	RollVariants      []RollVariant `json:"rollVariants"`
	DiceRules         string        `json:"diceRules,omitempty"`
	// Deprecated: legacy field, replaced by DiceRules. Kept on the struct so
	// pre-rework session JSON migrates on load (Migrate copies the referenced
	// lore entry's text into DiceRules and clears this).
	DiceRulesLoreID string      `json:"diceRulesLoreId,omitempty"`
	AuFreq          int         `json:"auFreq"`
	TTS             TTSSettings `json:"tts"`

	// Chapters (v6)
	Chapters         []Chapter `json:"chapters"`
	ActiveChapterID  string    `json:"activeChapterId,omitempty"`
	ViewingChapterID string    `json:"viewingChapterId,omitempty"`
	ArchivedChapters []Chapter `json:"archivedChapters,omitempty"`

	// Context budget (v5+)
	EffectiveCtxTokens int `json:"effectiveCtxTokens,omitempty"`

	// Per-session token caps (overrides built-in defaults; nil = default).
	TokenCaps *TokenCaps `json:"tokenCaps,omitempty"`

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
	Tag     string `json:"tag"` // "world", "location", "faction", "character", "mechanic", "quest", "item", "creature", "other"
	Enabled bool   `json:"enabled"`
}

// NormalizeLoreTag renames legacy tags to the current set.
func NormalizeLoreTag(tag string) string {
	if tag == "rule" {
		return "mechanic"
	}
	return tag
}

// NormalizeLoreTags rewrites legacy tags in place. Returns true if any entry changed.
func NormalizeLoreTags(lore []LoreEntry) bool {
	changed := false
	for i := range lore {
		if n := NormalizeLoreTag(lore[i].Tag); n != lore[i].Tag {
			lore[i].Tag = n
			changed = true
		}
	}
	return changed
}

type Section struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Content     string `json:"content"`
}

// Note is a player-authored OOC scratch note. Not sent to the AI; travels with the session.
type Note struct {
	ID        string `json:"id"`
	Body      string `json:"body"`
	CreatedAt int64  `json:"createdAt,omitempty"`
	UpdatedAt int64  `json:"updatedAt,omitempty"`
}

// DiceSpec is one die definition inside a RollVariant: a dice expression
// (Count d Sides, e.g. 2d6) paired with a free-form type label that appears
// in the formatted roll text.
type DiceSpec struct {
	Count int    `json:"count"`
	Sides int    `json:"sides"`
	Type  string `json:"type"`
	// Deprecated: legacy "NdM" string from before count/sides were split out.
	// Migrated on load and dropped from saves via omitempty.
	Dice string `json:"dice,omitempty"`
}

// RollVariant is a named bundle of dice the player can invoke before an action.
// The dice-resolution rules shared across every variant live on the GameState /
// Scenario as the DiceRules string.
type RollVariant struct {
	ID   string     `json:"id"`
	Name string     `json:"name"`
	Dice []DiceSpec `json:"dice"`
}

// Scenario is a reusable session template (overview + style + lore + sections).
type Scenario struct {
	ID           string        `json:"id"`
	Name         string        `json:"name"`
	Description  string        `json:"description"`
	Overview     string        `json:"overview"`
	CStyle       string        `json:"cStyle"`
	Style        string        `json:"style"`
	Diff         string        `json:"diff"`
	Lore         []LoreEntry   `json:"lore"`
	Secs         []Section     `json:"secs"`
	RollVariants []RollVariant `json:"rollVariants"`
	DiceRules    string        `json:"diceRules,omitempty"`
	// Deprecated: legacy field, replaced by DiceRules. Migrated on load.
	DiceRulesLoreID string `json:"diceRulesLoreId,omitempty"`
	CreatedAt       int64  `json:"createdAt"`
	UpdatedAt       int64  `json:"updatedAt"`
}

// MigrateScenarioDiceRules runs the same DiceRulesLoreID -> DiceRules migration
// for a Scenario. Returns true if the scenario changed.
func MigrateScenarioDiceRules(sc *Scenario) bool {
	return migrateDiceRulesLoreID(&sc.DiceRulesLoreID, &sc.DiceRules, sc.Lore)
}

// MigrateScenarioDice walks the scenario's roll variants and migrates legacy
// "NdM" Dice strings into Count/Sides. Returns true if any spec changed.
func MigrateScenarioDice(sc *Scenario) bool {
	return migrateRollVariantsDice(sc.RollVariants)
}

var diceLegacyRE = regexp.MustCompile(`^(\d+)d(\d+)$`)

// migrateDiceSpec parses a legacy "NdM" Dice string into Count/Sides and clears
// the legacy field. Falls back to {1, 6} when the string is unparseable but
// non-empty so the variant stays usable. Returns true when it touched anything.
func migrateDiceSpec(d *DiceSpec) bool {
	if d.Dice == "" {
		return false
	}
	if d.Count == 0 && d.Sides == 0 {
		if m := diceLegacyRE.FindStringSubmatch(strings.TrimSpace(d.Dice)); m != nil {
			c, _ := strconv.Atoi(m[1])
			s, _ := strconv.Atoi(m[2])
			if c > 0 && s > 0 {
				d.Count = c
				d.Sides = s
			}
		}
		if d.Count == 0 || d.Sides == 0 {
			d.Count = 1
			d.Sides = 6
		}
	}
	d.Dice = ""
	return true
}

// migrateRollVariantsDice walks every die in every variant and runs
// migrateDiceSpec. Returns true if any spec changed.
func migrateRollVariantsDice(variants []RollVariant) bool {
	changed := false
	for i := range variants {
		for j := range variants[i].Dice {
			if migrateDiceSpec(&variants[i].Dice[j]) {
				changed = true
			}
		}
	}
	return changed
}

// CombineActionAndRoll joins the player's typed action with the formatted roll
// text for storage in a Turn. The current-turn prompt sends them separately;
// this combined form is what later turns see in <story_so_far>.
func CombineActionAndRoll(action, roll string) string {
	a := strings.TrimSpace(action)
	r := strings.TrimSpace(roll)
	if a != "" && r != "" {
		sep := ". "
		switch a[len(a)-1] {
		case '.', '!', '?':
			sep = " "
		}
		return a + sep + r
	}
	if a != "" {
		return a
	}
	return r
}

// migrateDiceRulesLoreID copies the referenced lore entry's text into the new
// DiceRules string and clears the legacy pointer. Returns true if changed.
func migrateDiceRulesLoreID(loreID *string, diceRules *string, lore []LoreEntry) bool {
	if *loreID == "" || strings.TrimSpace(*diceRules) != "" {
		// Nothing to migrate, but still drop a stale pointer so it doesn't linger.
		if *loreID != "" {
			*loreID = ""
			return true
		}
		return false
	}
	for _, l := range lore {
		if l.ID == *loreID {
			*diceRules = strings.TrimSpace(l.Text)
			break
		}
	}
	*loreID = ""
	return true
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
	if NormalizeLoreTags(s.Lore) {
		changed = true
	}
	if migrateDiceRulesLoreID(&s.DiceRulesLoreID, &s.DiceRules, s.Lore) {
		changed = true
	}
	if migrateRollVariantsDice(s.RollVariants) {
		changed = true
	}
	if s.Secs == nil {
		s.Secs = []Section{}
		changed = true
	}
	if s.Notes == nil {
		s.Notes = []Note{}
		changed = true
	}
	if s.RollVariants == nil {
		s.RollVariants = []RollVariant{}
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
		Notes:              []Note{},
		RollVariants:       []RollVariant{},
		Chapters:           []Chapter{},
		EffectiveCtxTokens: 32000,
		Format:             FormatV6,
	}
	s.ensureActiveChapter()
	s.ViewingChapterID = s.ActiveChapterID
	return s
}
