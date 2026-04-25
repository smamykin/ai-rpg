package game

import (
	"fmt"
	"strings"
)

const SystemPrompt = `You are the world's best Game Master — a masterful storyteller with perfect pacing, intrigue, and a knack for keeping players on the edge of their seat. You simulate an open-world text adventure RPG.

Context tags you may receive (treat them as ground truth):
- <lore>: persistent world and character facts. Never contradict.
- <overview>: the adventure's premise and setup.
- <story_so_far>: past narrative. Earlier chapters are condensed summaries; the current chapter is full text. Player actions are prefixed with ">".
- <current_game_state>: tracked stats, inventory, and flags. Authoritative — overrides any conflicting narrative memory.
- <difficulty>: tone and consequence modifier.
- <director_note>: out-of-band steering from the user. Could be a plot beat to head toward, a focus request ("describe the ship in more detail"), or a tone nudge. Honor it naturally without breaking immersion or narrating it as meta.
- <dice_rules>: rules invoked by the player's roll this turn. The action text will contain the rolled outcomes (e.g. "dice 1(red 2d6) resulted 11"); interpret them against these rules and narrate the consequences.
- <task>: what to write this turn. Follow it exactly.

Rules:
- Use 2nd person perspective ("You walk into...")
- NEVER make choices for the player or invoke new player actions
- Let the player carve their own path — do NOT railroad them
- The world is real and exists beyond the player; NPCs have their own lives
- Vary pacing. Introduce new arcs when appropriate, but don't overdo it
- Default to warm, good-natured tone between friendly characters
- Mature themes allowed: portray conflict and suffering realistically
- Enforce game-world rules (no magic without ability, zero mana = no spells, etc.)
- Avoid contrived coincidences and overly convenient plot devices
- Note interactable objects/items/exits in the environment
- Avoid repetition of previous text
- NEVER use: cacophony, symphony, verdant, tapestry, testament, sentinel, cerulean
- Avoid purple prose, excessive metaphors, exposition dumps`

// PromptSection is one labeled part of the assembled user prompt.
type PromptSection struct {
	Label  string `json:"label"`
	Text   string `json:"text"`
	Tokens int    `json:"tokens"`
}

// PromptPreview breaks the prompt down for the UI.
type PromptPreview struct {
	System   PromptSection   `json:"system"`
	Sections []PromptSection `json:"sections"`
	User     string          `json:"user"`
	Response int             `json:"response"`
	Total    int             `json:"total"`
	Budget   int             `json:"budget"`
}

// charsPerToken matches frontend/src/utils/budget.ts so the two displays agree.
const charsPerToken = 4

func estimateTokens(s string) int {
	n := len(s)
	if n == 0 {
		return 0
	}
	return (n + charsPerToken - 1) / charsPerToken
}

// buildSections returns the ordered labeled sections that make up the user prompt.
// BuildPrompt and BuildPromptPreview both call this so the two cannot drift.
// hasRolls signals that the player invoked one or more roll variants this turn,
// which causes the shared DiceRulesLoreID lore entry to be hoisted into a
// <dice_rules> block right before <task>.
func buildSections(state *GameState, task, action string, hasRolls bool) []PromptSection {
	out := []PromptSection{}

	// The shared dice-rules lore is excluded from general <lore> so rules don't
	// clutter non-roll turns, and re-introduced in <dice_rules> only when a roll
	// is in play.
	rulesLoreID := state.DiceRulesLoreID

	// Lore
	var lb strings.Builder
	var enabledLore []LoreEntry
	for _, l := range state.Lore {
		if rulesLoreID != "" && l.ID == rulesLoreID {
			continue
		}
		if l.Enabled && strings.TrimSpace(l.Text) != "" {
			enabledLore = append(enabledLore, l)
		}
	}
	if len(enabledLore) > 0 {
		lb.WriteString("<lore>\n")
		for _, l := range enabledLore {
			fmt.Fprintf(&lb, "**%s**: %s\n\n", l.Name, strings.TrimSpace(l.Text))
		}
		lb.WriteString("</lore>\n\n")
		out = append(out, PromptSection{Label: "Lore", Text: lb.String()})
	}

	// Overview
	if state.Overview != "" {
		out = append(out, PromptSection{
			Label: "Overview",
			Text:  fmt.Sprintf("<overview>\n%s\n</overview>\n\n", state.Overview),
		})
	}

	// Story so far
	if sb := buildStoryBody(state); strings.TrimSpace(sb) != "" {
		out = append(out, PromptSection{Label: "Story so far", Text: sb})
	}

	// Game state sections
	var gb strings.Builder
	var filled []Section
	for _, s := range state.Secs {
		if strings.TrimSpace(s.Content) != "" {
			filled = append(filled, s)
		}
	}
	if len(filled) > 0 {
		gb.WriteString("<current_game_state>\n")
		for _, s := range filled {
			fmt.Fprintf(&gb, "[%s]:\n%s\n\n", s.Name, strings.TrimSpace(s.Content))
		}
		gb.WriteString("</current_game_state>\n\n")
		out = append(out, PromptSection{Label: "Tracking", Text: gb.String()})
	}

	// Difficulty
	if state.Diff == "hard" {
		out = append(out, PromptSection{
			Label: "Difficulty",
			Text:  "<difficulty>VERY HARD — permadeath, realistic consequences, impossible actions fail.</difficulty>\n\n",
		})
	}

	// Director note (user-provided steering: plot target, focus ask, tone nudge, etc.)
	if arc := strings.TrimSpace(state.Arc); arc != "" {
		out = append(out, PromptSection{
			Label: "Director note",
			Text:  fmt.Sprintf("<director_note>\n%s\n</director_note>\n\n", arc),
		})
	}

	// Dice rules — hoisted when the player rolled any variant this turn.
	if hasRolls && rulesLoreID != "" {
		for _, l := range state.Lore {
			if l.ID != rulesLoreID {
				continue
			}
			if strings.TrimSpace(l.Text) == "" {
				break
			}
			text := fmt.Sprintf("<dice_rules>\n**%s**: %s\n</dice_rules>\n\n", l.Name, strings.TrimSpace(l.Text))
			out = append(out, PromptSection{Label: "Dice rules", Text: text})
			break
		}
	}

	// Task instruction
	styleSuffix := ""
	if cs := strings.TrimSpace(state.CStyle); cs != "" {
		styleSuffix = "\nWRITING STYLE: " + cs
	}
	var taskText string
	switch task {
	case "open":
		taskText = fmt.Sprintf("<task>\nWrite the opening paragraph based on the <overview> above. One paragraph only — just the START. Specific situation, maybe NPC dialogue. Avoid grandiose phrasing.%s\n</task>", styleSuffix)
	case "action":
		taskText = fmt.Sprintf("<task>\nPlayer's action: \"%s\"\nWrite direct consequences. Include NPC dialogue if relevant. Do NOT make choices for the player.\nRESPONSE LENGTH: %s. Do NOT exceed this.%s\n</task>", action, state.Style, styleSuffix)
	default: // "continue"
		taskText = fmt.Sprintf("<task>\nContinue the story naturally. Include dialogue when relevant.\nRESPONSE LENGTH: %s. Do NOT exceed this.%s\n</task>", state.Style, styleSuffix)
	}
	out = append(out, PromptSection{Label: "Task", Text: taskText})

	// Fill token counts.
	for i := range out {
		out[i].Tokens = estimateTokens(out[i].Text)
	}
	return out
}

// BuildPrompt assembles the full user prompt from all game context.
func BuildPrompt(state *GameState, task, action string, hasRolls bool) string {
	var b strings.Builder
	for _, s := range buildSections(state, task, action, hasRolls) {
		b.WriteString(s.Text)
	}
	return b.String()
}

// BuildPromptPreview returns the prompt in labeled sections with token estimates.
// The system prompt is reported separately; the "response" field reflects the
// reserved headroom for the model's reply.
func BuildPromptPreview(state *GameState, task, action string, hasRolls bool) PromptPreview {
	sections := buildSections(state, task, action, hasRolls)

	var ub strings.Builder
	for _, s := range sections {
		ub.WriteString(s.Text)
	}
	user := ub.String()

	sysSection := PromptSection{
		Label:  "System",
		Text:   SystemPrompt,
		Tokens: estimateTokens(SystemPrompt),
	}
	response := state.MaxTokensForStyle(state.Style)

	total := sysSection.Tokens + response
	for _, s := range sections {
		total += s.Tokens
	}

	return PromptPreview{
		System:   sysSection,
		Sections: sections,
		User:     user,
		Response: response,
		Total:    total,
		Budget:   state.EffectiveCtxTokens,
	}
}

// buildStoryBody assembles the story-so-far section of the prompt. Acts and closed
// chapters contribute their summary; the active chapter contributes its full content.
// Children of acts are skipped (only the act's own summary matters to the model).
func buildStoryBody(state *GameState) string {
	var b strings.Builder
	hasAny := false

	writeHeader := func() {
		if !hasAny {
			b.WriteString("<story_so_far>\n(Player actions are prefixed with \">\".)\n\n")
			hasAny = true
		}
	}

	// Collect IDs of chapters that are children of any act — these are skipped (the act represents them).
	childOfAct := map[string]bool{}
	for _, c := range state.Chapters {
		if c.Status == "act" {
			for _, id := range c.Children {
				childOfAct[id] = true
			}
		}
	}

	for _, c := range state.Chapters {
		if childOfAct[c.ID] {
			continue
		}
		title := chapterTitleOrFallback(c)
		switch c.Status {
		case "act":
			s := strings.TrimSpace(c.Summary)
			if s == "" {
				continue
			}
			writeHeader()
			fmt.Fprintf(&b, "## %s (condensed)\n%s\n\n", title, s)
		case "closed":
			s := strings.TrimSpace(c.Summary)
			if s == "" {
				continue
			}
			writeHeader()
			fmt.Fprintf(&b, "## %s\n%s\n\n", title, s)
		case "active":
			content := strings.TrimSpace(c.RenderedContent())
			if content == "" {
				continue
			}
			writeHeader()
			if title != "" {
				fmt.Fprintf(&b, "## %s (current)\n%s\n\n", title, content)
			} else {
				fmt.Fprintf(&b, "## Current chapter\n%s\n\n", content)
			}
		}
	}

	if hasAny {
		b.WriteString("</story_so_far>\n\n")
	}
	return b.String()
}

func chapterTitleOrFallback(c Chapter) string {
	t := strings.TrimSpace(c.Title)
	if t != "" {
		return t
	}
	return ""
}

// SummarizeSystemPrompt is used for per-chapter summarization.
const SummarizeSystemPrompt = `You are a precise narrative summarizer for a text RPG. Your summaries are the memory of the story — they are what the Game Master reads to remember what happened. Preserve player agency and continuity above all else.`

// SummarizeUserPrompt returns the instruction+payload for per-chapter summarization.
// The input text is raw story content (player actions prefixed with ">").
func SummarizeUserPrompt(text string) string {
	return `Summarize this chapter in roughly one third of its length. Write in past tense, narrator voice.

MUST preserve:
- Every named character and their role/state (alive, injured, angry at whom, with whom)
- Items gained, lost, used, or broken
- Locations visited, in order
- Player decisions and their consequences (player actions were prefixed with "> " in the text)
- Unresolved threads, promises, deadlines, open questions
- Relationship changes between characters
- Any rules, mechanics, or world-state changes

OMIT:
- Scenery and mood prose beyond what affects plot
- Dialogue unless it reveals a decision, commitment, or key fact
- Redundant action beats

Output ONLY the summary prose. No meta commentary, no bullet list, no headers.

---
` + text
}

// CondenseSystemPrompt is used when condensing multiple chapter summaries into one act summary.
const CondenseSystemPrompt = `You are a precise narrative summarizer. Condense multiple chapter summaries into one cohesive overview, preserving continuity signals (characters, items, unresolved threads).`

// CondenseUserPrompt returns the instruction+payload for act condensation.
func CondenseUserPrompt(joinedSummaries string) string {
	return `Condense these chapter summaries into one cohesive overview at roughly one third of the combined length. Past tense, narrator voice.

MUST preserve:
- Named characters still relevant to current events and their state
- Items and locations that matter going forward
- Unresolved threads, open questions, commitments
- Key turning points

OMIT:
- Resolved side-plots that no longer affect the present
- Minor characters who have left the story
- Procedural detail

Output ONLY the condensed summary. No meta commentary.

---
` + joinedSummaries
}
