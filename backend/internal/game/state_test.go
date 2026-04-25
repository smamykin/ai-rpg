package game

import (
	"testing"
)

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
