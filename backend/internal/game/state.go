package game

// GameState holds the full game state, mirroring the prototype's localStorage shape.
type GameState struct {
	Story        string    `json:"story"`
	Overview     string    `json:"overview"`
	Style        string    `json:"style"`
	CStyle       string    `json:"cStyle"`
	StoryModel   string    `json:"storyModel"`
	SupportModel string    `json:"supportModel"`
	Arc          string    `json:"arc"`
	Diff         string    `json:"diff"`
	Mems         []Memory  `json:"mems"`
	AddlMem      string    `json:"addlMem"`
	SumUpTo      int       `json:"sumUpTo"`
	Secs         []Section `json:"secs"`
	AuFreq       int       `json:"auFreq"`
	Format       string    `json:"format,omitempty"`
}

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

func DefaultState() *GameState {
	return &GameState{
		Style:  "1 paragraph",
		Diff:   "normal",
		Mems:   []Memory{},
		Secs:   []Section{},
		Format: "ai-rpg-nano-v1",
	}
}
