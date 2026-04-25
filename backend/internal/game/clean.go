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

// thinkBlock matches a complete <think>...</think> (or <thinking>...</thinking>)
// block. Some thinking models (DeepSeek-R1 family, etc.) emit reasoning inline
// in the content stream rather than only in the separate `reasoning` field, so
// without this they leak into the saved turn response.
var thinkBlock = regexp.MustCompile(`(?is)<think(?:ing)?>.*?</think(?:ing)?>\s*`)

// thinkOpenTrailing matches an unclosed <think>... at the end of the buffer.
// During streaming the closing tag may not have arrived yet — hide everything
// after the opening tag so the partial thought never flashes into the story.
var thinkOpenTrailing = regexp.MustCompile(`(?is)<think(?:ing)?>.*$`)

// Clean strips banned words/phrases and trailing ambient sections from generated text.
func Clean(text string) string {
	result := thinkBlock.ReplaceAllString(text, "")
	result = thinkOpenTrailing.ReplaceAllString(result, "")
	for _, r := range replacements {
		result = r.pattern.ReplaceAllString(result, r.replacement)
	}
	result = ambientOutro.ReplaceAllString(result, "")
	return strings.TrimSpace(result)
}
