// Now that CardEditor outputs HTML directly, rendering is a simple
// dangerouslySetInnerHTML inject. No parse step needed.

interface Props {
  html: string;
  className?: string;
}

export function HtmlRenderer({ html, className = '' }: Props) {
  if (!html) return null;
  return (
    <div
      className={`card-content ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// Cloze: the {{token}} splitting still happens at the string level,
// but each segment may now contain HTML from the editor, so we inject
// each piece as HTML rather than as plain text.
interface ClozeProps {
  html: string;
  revealed: boolean;
  className?: string;
}

export function ClozeHtmlRenderer({ html, revealed, className = '' }: ClozeProps) {
  const parts = html.split(/\{\{(.+?)\}\}/g);

  const assembled = parts.map((part, i) => {
    if (i % 2 === 0) return part;
    if (revealed) {
      return `<span class="cloze-revealed">${part}</span>`;
    } else {
      return `<span class="cloze-hidden" aria-label="blank">${part}</span>`;
    }
  }).join('');

  return (
    <div
      className={`card-content ${className}`}
      dangerouslySetInnerHTML={{ __html: assembled }}
    />
  );
}