package game

import (
	"regexp"
	"strings"
)

var replacements = []struct {
	pattern     *regexp.Regexp
	replacement string
}{
	{regexp.MustCompile(`(?i)the cacophony`), "the sound"},
	{regexp.MustCompile(`(?i)was thick with`), "had"},
	{regexp.MustCompile(`(?i)symphony of`), "pattern of"},
	{regexp.MustCompile(`(?i)tapestry of`), "pattern of"},
	{regexp.MustCompile(`(?i)\bshade of emerald\b`), "shade of green"},
	{regexp.MustCompile(`(?i)\bstark reminder\b`), "reminder"},
}

var ambientOutro = regexp.MustCompile(`# Ambient Outro[\s\S]*`)

// Clean strips banned words/phrases and trailing ambient sections from generated text.
func Clean(text string) string {
	result := text
	for _, r := range replacements {
		result = r.pattern.ReplaceAllString(result, r.replacement)
	}
	result = ambientOutro.ReplaceAllString(result, "")
	return strings.TrimSpace(result)
}
