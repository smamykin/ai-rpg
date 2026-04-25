package game

import (
	"fmt"
	"strings"
	"time"
)

// Schema versioning. Major bumps when stored data can't be migrated and the
// user must wipe (the API surfaces this as 426 + a popup). Minor bumps when
// in-place migration code can advance the data — register a func in
// stateMigrations / scenarioMigrations indexed by source minor. Plain field
// additions don't bump anything; EnsureInvariants fills defaults.
const (
	CurrentSchemaMajor = 1
	CurrentSchemaMinor = 0
)

// SchemaWipeRequiredError signals that stored data is on a major version the
// running code can't migrate. The handler turns this into HTTP 426.
type SchemaWipeRequiredError struct {
	StoredMajor  int
	StoredMinor  int
	CurrentMajor int
	CurrentMinor int
}

func (e *SchemaWipeRequiredError) Error() string {
	return fmt.Sprintf("schema wipe required: stored %d.%d, current %d.%d",
		e.StoredMajor, e.StoredMinor, e.CurrentMajor, e.CurrentMinor)
}

// stateMigrations[i] migrates a GameState from minor version i to i+1.
// Add entries when CurrentSchemaMinor is bumped.
var stateMigrations = []func(*GameState){}

// scenarioMigrations[i] migrates a Scenario from minor version i to i+1.
var scenarioMigrations = []func(*Scenario){}

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
	AuFreq            int           `json:"auFreq"`
	TTS               TTSSettings   `json:"tts"`

	// Chapters (v6)
	Chapters         []Chapter `json:"chapters"`
	ActiveChapterID  string    `json:"activeChapterId,omitempty"`
	ViewingChapterID string    `json:"viewingChapterId,omitempty"`
	ArchivedChapters []Chapter `json:"archivedChapters,omitempty"`

	// Context budget (v5+)
	EffectiveCtxTokens int `json:"effectiveCtxTokens,omitempty"`

	// Per-session token caps (overrides built-in defaults; nil = default).
	TokenCaps *TokenCaps `json:"tokenCaps,omitempty"`

	// Schema version of this stored state. See CurrentSchemaMajor/Minor.
	SchemaMajor int `json:"schemaMajor"`
	SchemaMinor int `json:"schemaMinor"`
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
	CreatedAt    int64         `json:"createdAt"`
	UpdatedAt    int64         `json:"updatedAt"`

	SchemaMajor int `json:"schemaMajor"`
	SchemaMinor int `json:"schemaMinor"`
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

// MigrateState advances stored state to the current schema version. Returns
// SchemaWipeRequiredError if the stored major doesn't match (or stored minor
// is from a future version). Unversioned (zero-zero) data is treated as
// freshly written at the current version.
func MigrateState(s *GameState) error {
	if s.SchemaMajor == 0 && s.SchemaMinor == 0 {
		s.SchemaMajor = CurrentSchemaMajor
		s.SchemaMinor = CurrentSchemaMinor
		return nil
	}
	if s.SchemaMajor != CurrentSchemaMajor || s.SchemaMinor > CurrentSchemaMinor {
		return &SchemaWipeRequiredError{
			StoredMajor:  s.SchemaMajor,
			StoredMinor:  s.SchemaMinor,
			CurrentMajor: CurrentSchemaMajor,
			CurrentMinor: CurrentSchemaMinor,
		}
	}
	for i := s.SchemaMinor; i < CurrentSchemaMinor; i++ {
		stateMigrations[i](s)
	}
	s.SchemaMinor = CurrentSchemaMinor
	return nil
}

// MigrateScenario is the Scenario equivalent of MigrateState.
func MigrateScenario(sc *Scenario) error {
	if sc.SchemaMajor == 0 && sc.SchemaMinor == 0 {
		sc.SchemaMajor = CurrentSchemaMajor
		sc.SchemaMinor = CurrentSchemaMinor
		return nil
	}
	if sc.SchemaMajor != CurrentSchemaMajor || sc.SchemaMinor > CurrentSchemaMinor {
		return &SchemaWipeRequiredError{
			StoredMajor:  sc.SchemaMajor,
			StoredMinor:  sc.SchemaMinor,
			CurrentMajor: CurrentSchemaMajor,
			CurrentMinor: CurrentSchemaMinor,
		}
	}
	for i := sc.SchemaMinor; i < CurrentSchemaMinor; i++ {
		scenarioMigrations[i](sc)
	}
	sc.SchemaMinor = CurrentSchemaMinor
	return nil
}

// EnsureInvariants initializes nil slices, defaults, and the active/viewing
// chapter pointers so the rest of the code can rely on a fully-formed state.
// Runs on every load/save/import. Returns true if anything was changed.
func (s *GameState) EnsureInvariants() bool {
	changed := false

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

// ActiveChapter returns the active chapter, or nil if none (should not happen after EnsureInvariants).
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
		SchemaMajor:        CurrentSchemaMajor,
		SchemaMinor:        CurrentSchemaMinor,
	}
	s.ensureActiveChapter()
	s.ViewingChapterID = s.ActiveChapterID
	return s
}
