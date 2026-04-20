package game

import (
	"encoding/json"
	"testing"
)

// TestMigrateEmptyFormatPreservesChapters verifies the issue-5 fix: a frontend
// PUT /state body that doesn't echo the `format` field must NOT wipe chapters.
func TestMigrateEmptyFormatPreservesChapters(t *testing.T) {
	body := `{
		"chapters": [{"id":"ch_1","content":"You sit in the restaurant.","status":"active","createdAt":1}],
		"activeChapterId": "ch_1"
	}`
	var s GameState
	if err := json.Unmarshal([]byte(body), &s); err != nil {
		t.Fatal(err)
	}
	s.Migrate()
	if len(s.Chapters) != 1 || s.Chapters[0].Content == "" {
		t.Fatalf("chapter content was wiped: %+v", s.Chapters)
	}
	if s.Chapters[0].ID != "ch_1" {
		t.Fatalf("chapter id was replaced: %s", s.Chapters[0].ID)
	}
	if s.Format != FormatV5 {
		t.Fatalf("format should be set to current: %s", s.Format)
	}
}

// TestMigrateKnownLegacyStillWipes preserves the migration path for real legacy sessions.
func TestMigrateKnownLegacyStillWipes(t *testing.T) {
	s := GameState{
		Format: "ai-rpg-nano-v4",
		Chapters: []Chapter{{ID: "ch_1", Content: "legacy content", Status: "active"}},
		ActiveChapterID: "ch_1",
	}
	s.Migrate()
	// Legacy wipe should have cleared play progress, then ensureActiveChapter
	// re-added a single blank active chapter.
	if len(s.Chapters) != 1 || s.Chapters[0].Content != "" {
		t.Fatalf("legacy wipe didn't clear content: %+v", s.Chapters)
	}
}
