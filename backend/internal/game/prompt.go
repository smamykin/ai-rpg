package game

import (
	"fmt"
	"strings"
)

const SystemPrompt = `You are the world's best Game Master — a masterful storyteller with perfect pacing, intrigue, and a knack for keeping players on the edge of their seat. You simulate an open-world text adventure RPG.

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
- Avoid purple prose, excessive metaphors, exposition dumps
- If <current_game_state> is provided, respect it strictly`

// BuildPrompt assembles the full user prompt from all game context.
func BuildPrompt(state *GameState, task, action string) string {
	var b strings.Builder

	// Lore entries (only enabled)
	var enabledLore []LoreEntry
	for _, l := range state.Lore {
		if l.Enabled && strings.TrimSpace(l.Text) != "" {
			enabledLore = append(enabledLore, l)
		}
	}
	if len(enabledLore) > 0 {
		b.WriteString("# World & Character Lore:\n")
		for _, l := range enabledLore {
			fmt.Fprintf(&b, "**%s**: %s\n\n", l.Name, strings.TrimSpace(l.Text))
		}
	}

	// Overview
	if state.Overview != "" {
		fmt.Fprintf(&b, "# Adventure Overview:\n%s\n\n", state.Overview)
	}

	// Story so far — chapters in order. Acts and closed chapters contribute summary;
	// the active chapter contributes full content.
	storyBody := buildStoryBody(state)
	if strings.TrimSpace(storyBody) != "" {
		b.WriteString(storyBody)
	}

	// Game state sections
	var filled []Section
	for _, s := range state.Secs {
		if strings.TrimSpace(s.Content) != "" {
			filled = append(filled, s)
		}
	}
	if len(filled) > 0 {
		b.WriteString("<current_game_state>\n")
		for _, s := range filled {
			fmt.Fprintf(&b, "[%s]:\n%s\n\n", s.Name, strings.TrimSpace(s.Content))
		}
		b.WriteString("</current_game_state>\n\n")
	}

	// Difficulty
	if state.Diff == "hard" {
		b.WriteString("DIFFICULTY: VERY HARD — permadeath, realistic consequences, impossible actions fail.\n\n")
	}

	// Story arc
	if strings.TrimSpace(state.Arc) != "" {
		fmt.Fprintf(&b, "NEXT_KEY_EVENT (*naturally* guide the story towards this): %s\n\n", strings.TrimSpace(state.Arc))
	}

	// Writing style suffix
	styleSuffix := ""
	if strings.TrimSpace(state.CStyle) != "" {
		styleSuffix = "\nWRITING STYLE: " + strings.TrimSpace(state.CStyle)
	}

	// Task instruction
	switch task {
	case "open":
		fmt.Fprintf(&b, "TASK: Write the opening paragraph based on the Adventure Overview above. One paragraph only — just the START. Specific situation, maybe NPC dialogue. Avoid grandiose phrasing.%s", styleSuffix)
	case "action":
		fmt.Fprintf(&b, "TASK: Player's action: \"%s\"\nWrite direct consequences. Include NPC dialogue if relevant. Do NOT make choices for the player.\nRESPONSE LENGTH: %s. Do NOT exceed this.%s", action, state.Style, styleSuffix)
	default: // "continue"
		fmt.Fprintf(&b, "TASK: Continue the story naturally. Include dialogue when relevant.\nRESPONSE LENGTH: %s. Do NOT exceed this.%s", state.Style, styleSuffix)
	}

	return b.String()
}

// buildStoryBody assembles the story-so-far section of the prompt. Acts and closed
// chapters contribute their summary; the active chapter contributes its full content.
// Children of acts are skipped (only the act's own summary matters to the model).
func buildStoryBody(state *GameState) string {
	var b strings.Builder
	hasAny := false

	writeHeader := func() {
		if !hasAny {
			b.WriteString("# Story So Far (player actions prefixed with \">\"):\n\n")
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
			content := strings.TrimSpace(c.Content)
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

	return b.String()
}

func chapterTitleOrFallback(c Chapter) string {
	t := strings.TrimSpace(c.Title)
	if t != "" {
		return t
	}
	return ""
}

// MaxTokensForStyle returns the max_tokens value based on the response length style.
func MaxTokensForStyle(style string) int {
	switch style {
	case "1 sentence":
		return 150
	case "1 paragraph":
		return 400
	case "2-3 paragraphs":
		return 800
	case "3-4 detailed paragraphs":
		return 1200
	default:
		return 400
	}
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
const CondenseSystemPrompt = `You are a precise narrative summarizer. Condense multiple chapter summaries into a single cohesive overview, preserving continuity signals (characters, items, unresolved threads).`

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
