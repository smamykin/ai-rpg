export const SCENARIO_CREATION_PROMPT = `You are helping me design a scenario for an AI-driven text RPG. A scenario is a reusable session template: name, short pitch, setting overview, writing style, difficulty, lore entries, and optional tracked stats.

How to run this conversation:
1. Ask me what kind of adventure I have in mind — genre, mood, protagonist, setting, tone. Pull details out of me.
2. Brainstorm with me. Suggest hooks, conflicts, notable characters, places, and rules. Push back when something feels generic or thin. Offer 2-3 concrete options rather than one take-it-or-leave-it idea.
3. When we have agreed on the shape of the scenario, produce a SINGLE final JSON block matching the schema below. The final message must contain ONLY that JSON, fenced as a \`\`\`json code block, with no prose before or after — so I can paste it directly into the app's Import button.

Schema (all fields required unless marked optional):
{
  "name":        string - short title shown on the scenario card
  "description": string - one-line pitch shown under the title in the picker
  "overview":    string - 2-5 sentence premise that the AI GM reads every turn (setting, protagonist hook, current situation)
  "cStyle":      string - writing-style hint, e.g. "dark and literary"; use "" to skip
  "style":       one of "1 paragraph" | "2-3 paragraphs" | "1 sentence" | "3-4 detailed paragraphs"
  "diff":        "normal" | "hard"
  "lore": [
    {
      "id":      string - unique within the array, e.g. "l1", "l2", ...
      "name":    string - short label
      "text":    string - 1-3 short paragraphs of lore
      "tag":     "world" | "location" | "faction" | "character" | "mechanic" | "quest" | "item" | "creature" | "other"
      "enabled": true
    }
  ],
  "secs": [
    {
      "id":          string - unique within the array, e.g. "s1", "s2", ...
      "name":        string - short label for what to track (e.g. "Inventory", "Health", "Relationships")
      "description": string - what this section represents and when the GM should update it
      "content":     string - starting state text shown in every prompt, or "" if none
    }
  ]
}

Rules for lore:
- Include 4-8 entries by default, mixing tags.
- "world" = overarching setting, cosmology, history. "location" = specific places (cities, regions, landmarks, dungeons). "faction" = organizations, factions, groups, cults, governments. "character" = specific named NPCs. "mechanic" = magic / physics / social rules that bind the story. "quest" = goals, hooks, or looming threats. "item" = artifacts, equipment, key objects. "creature" = monsters, beasts, non-named entities.
- Keep each entry concrete and evocative, not encyclopedic.

Rules for tracked stats (secs):
- Propose 0-3 sections that fit the scenario. Max 5. Leave "secs": [] if tracking isn't useful for this kind of story.
- "name" is one or two words: Inventory, Health, Relationships, Quests, Allies, Morale, Resources, Reputation, Cycle, etc.
- "description" tells the GM what belongs here and when to update it.
- "content" is the starting snapshot the player sees on turn one, e.g. "HP: 100/100\\nMana: 50/50" or "Gold: 50\\nDagger, rope, 3 rations". Use "\\n" for line breaks inside the JSON string. Leave "" if the GM should generate initial state from scratch.
- Prefer concrete, mechanical fields over vague vibes — the content gets re-read every turn.

Do NOT include "id", "createdAt", or "updatedAt" at the top level of the scenario — the app fills those in on import.

Begin now by asking me about the adventure.`
