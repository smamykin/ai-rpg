package game

import (
	"encoding/json"
	"testing"
)

// TestMigrateEmptyFormatPreservesChapters verifies that a frontend PUT /state
// body that doesn't echo the `format` field must NOT wipe chapters.
func TestMigrateEmptyFormatPreservesChapters(t *testing.T) {
	body := `{
		"chapters": [{"id":"ch_1","turns":[{"id":"t_1","response":"You sit in the restaurant."}],"status":"active","createdAt":1}],
		"activeChapterId": "ch_1"
	}`
	var s GameState
	if err := json.Unmarshal([]byte(body), &s); err != nil {
		t.Fatal(err)
	}
	s.Migrate()
	if len(s.Chapters) != 1 || len(s.Chapters[0].Turns) == 0 {
		t.Fatalf("chapter turns were wiped: %+v", s.Chapters)
	}
	if s.Chapters[0].ID != "ch_1" {
		t.Fatalf("chapter id was replaced: %s", s.Chapters[0].ID)
	}
	if s.Format != FormatV6 {
		t.Fatalf("format should be set to current: %s", s.Format)
	}
}

// TestMigrateKnownLegacyWipes preserves the migration path: any non-V6 format
// wipes chapters (dev-phase policy — no data migration).
func TestMigrateKnownLegacyWipes(t *testing.T) {
	s := GameState{
		Format:          "ai-rpg-nano-v5",
		Chapters:        []Chapter{{ID: "ch_1", Turns: []Turn{{ID: "t_1", Response: "legacy"}}, Status: "active"}},
		ActiveChapterID: "ch_1",
	}
	s.Migrate()
	// Legacy wipe should have cleared chapters, then ensureActiveChapter
	// re-added a single blank active chapter with no turns.
	if len(s.Chapters) != 1 || len(s.Chapters[0].Turns) != 0 {
		t.Fatalf("legacy wipe didn't clear turns: %+v", s.Chapters)
	}
	if s.Format != FormatV6 {
		t.Fatalf("format should bump to V6: %s", s.Format)
	}
}

// TestRenderedContent confirms the turn-to-string reconstruction matches the
// classic format used by prompt building and summarization.
func TestRenderedContent(t *testing.T) {
	c := Chapter{Turns: []Turn{
		{ID: "t_1", Response: "You wake in a dim room."},
		{ID: "t_2", Action: "look around", Response: "Dust motes drift in a single beam of light."},
		{ID: "t_3", Action: "open the door"},
	}}
	got := c.RenderedContent()
	want := "You wake in a dim room.\n\n> look around\n\nDust motes drift in a single beam of light.\n\n> open the door"
	if got != want {
		t.Fatalf("RenderedContent mismatch:\ngot:  %q\nwant: %q", got, want)
	}
}
