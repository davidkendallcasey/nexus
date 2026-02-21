import { parseMarkdown, parseMarkdownInline } from '../lib/markdown';

interface Props {
  text: string;
  className?: string;
}

// ─── Plain Markdown renderer ──────────────────────────────────────────────────
// For basic card fronts, backs, and extra fields.
// Renders full block-level Markdown (headings, lists, code blocks, tables, etc.)
export function MarkdownRenderer({ text, className = '' }: Props) {
  return (
    <div
      className={`md-prose ${className}`}
      dangerouslySetInnerHTML={{ __html: parseMarkdown(text) }}
    />
  );
}

// ─── Cloze-aware Markdown renderer ───────────────────────────────────────────
// Cloze tokens look like {{answer}} after pre-processing by addCard().
// Strategy:
//   1. Split the text on {{...}} tokens
//   2. Parse even-indexed segments (plain text) as inline Markdown
//   3. Render odd-indexed segments (the answers) as styled spans
//   4. Reassemble into a single HTML string and inject via dangerouslySetInnerHTML
//
// Why not just parse the whole string as Markdown?
// Because marked would treat `{{answer}}` as literal text inside a <p>, leaving
// us with no way to target the token spans for the hide/reveal effect afterwards.
// Pre-splitting gives us clean control over both concerns simultaneously.

interface ClozeProps {
  text: string;
  revealed: boolean;
  className?: string;
}

export function ClozeMarkdownRenderer({ text, revealed, className = '' }: ClozeProps) {
  const parts = text.split(/\{\{(.+?)\}\}/g);

  // Build the HTML string by processing each segment
  const html = parts.map((part, i) => {
    if (i % 2 === 0) {
      // Plain text segment — parse as inline Markdown
      return parseMarkdownInline(part);
    } else {
      // Token segment — render as styled span
      if (revealed) {
        return `<span class="cloze-revealed">${parseMarkdownInline(part)}</span>`;
      } else {
        // The text is inside the span so screen readers/copy still work,
        // but it's visually hidden via CSS colour matching the background.
        return `<span class="cloze-hidden" aria-label="blank">${parseMarkdownInline(part)}</span>`;
      }
    }
  }).join('');

  return (
    <div
      className={`md-prose ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}