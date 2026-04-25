package game

import "testing"

func TestCleanThinkTags(t *testing.T) {
	cases := []struct{ name, in, want string }{
		{"inline complete", "Hello <think>internal</think>world", "Hello world"},
		{"multiline", "<think>line1\nline2\nline3</think>\n\nThe story begins.", "The story begins."},
		{"thinking variant", "<thinking>foo</thinking>bar", "bar"},
		{"upper case", "<THINK>upper</THINK>after", "after"},
		{"multiple blocks", "He <think>a</think>said <think>b</think>hi", "He said hi"},
		{"no tags", "plain text", "plain text"},
		{"unclosed trailing", "start <think>partial mid-stream", "start"},
		{"only think", "<think>abc</think>", ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := Clean(c.in); got != c.want {
				t.Fatalf("Clean(%q) = %q; want %q", c.in, got, c.want)
			}
		})
	}
}
