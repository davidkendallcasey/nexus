import { marked } from 'marked';

// Configure marked once at module level.
// - gfm: GitHub Flavoured Markdown (tables, strikethrough, task lists)
// - breaks: single newlines become <br> — natural for flashcard content
marked.setOptions({
  gfm: true,
  breaks: true,
});

// Block-level parse — for full card fields (front, back, extra).
// Returns an HTML string. Always sanitise before using dangerouslySetInnerHTML.
export function parseMarkdown(text: string): string {
  return marked.parse(text) as string;
}

// Inline-only parse — for cloze segments between {{tokens}}.
// Avoids wrapping individual fragments in <p> tags, which breaks inline layout.
export function parseMarkdownInline(text: string): string {
  return marked.parseInline(text) as string;
}