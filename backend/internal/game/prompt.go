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

	// Summary entries
	filtered := make([]Memory, 0)
	for _, m := range state.Mems {
		if strings.TrimSpace(m.Text) != "" {
			filtered = append(filtered, m)
		}
	}
	if len(filtered) > 0 {
		b.WriteString("# Summary of Earlier Events:\n")
		for _, m := range filtered {
			b.WriteString(strings.TrimSpace(m.Text))
			b.WriteString("\n\n")
		}
	}

	// Additional memory
	if strings.TrimSpace(state.AddlMem) != "" {
		fmt.Fprintf(&b, "# Additional Context:\n%s\n\n", strings.TrimSpace(state.AddlMem))
	}

	// Overview
	if state.Overview != "" {
		fmt.Fprintf(&b, "# Adventure Overview:\n%s\n\n", state.Overview)
	}

	// Story so far
	if strings.TrimSpace(state.Story) != "" {
		fmt.Fprintf(&b, "# Story So Far (player actions prefixed with \">\"):\n%s\n\n", strings.TrimSpace(state.Story))
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
