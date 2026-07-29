// ---------------------------------------------------------------------------
// Lightweight stable hash — only used to generate React keys from Markdown
// line content. Not cryptographically strong — doesn't need to be.
// ---------------------------------------------------------------------------
const djb2 = (value) => {
  if (typeof value !== 'string' || value.length === 0) return '0';
  let hash = 5381;
  const limit = Math.min(value.length, 200);
  for (let index = 0; index < limit; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
};

const BOLD_PATTERN = /(\*\*[^*]+\*\*|__[^_]+__)/g;

const tokenizeInline = (text) => {
  if (typeof text !== 'string' || text.length === 0) return [];
  const parts = [];
  let lastIndex = 0;
  let match;

  // Reset regex state to prevent lastIndex carry-over across repeated calls.
  BOLD_PATTERN.lastIndex = 0;
  // eslint-disable-next-line no-cond-assign
  while ((match = BOLD_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    const raw = match[0];
    const isDoubleAsterisk = raw.startsWith('**');
    const strip = isDoubleAsterisk ? 2 : 2;
    parts.push({ type: 'bold', content: raw.slice(strip, raw.length - strip) });
    lastIndex = match.index + raw.length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }
  return parts;
};

const renderInlineMarkdown = (text, lineIndex) => {
  const tokens = tokenizeInline(text);
  if (tokens.length === 0) return null;
  return tokens.map((token, tokenIndex) => {
    const key = `p${lineIndex}-t${tokenIndex}-${token.type}-${djb2(token.content)}`;
    if (token.type === 'bold') {
      return <strong key={key}>{token.content}</strong>;
    }
    return token.content;
  });
};

export default function MarkdownText({ content }) {
  if (content == null) return null;
  const text = typeof content === 'string' ? content : String(content);
  const lines = text.split('\n');
  const contentHash = djb2(text);

  return (
    <div className="space-y-1 break-words leading-relaxed">
      {lines.map((line, index) => {
        const lineHash = djb2(line);
        const key = `L${index}-${lineHash}-${contentHash}`;

        if (!line.trim()) {
          return <p key={key} className="m-0 h-0">&nbsp;</p>;
        }

        const bullet = line.match(/^[-*]\s+(.+)/);
        if (bullet) {
          return (
            <div key={key} className="flex gap-2">
              <span aria-hidden="true">•</span>
              <span>{renderInlineMarkdown(bullet[1], index)}</span>
            </div>
          );
        }

        const numbered = line.match(/^(\d+)\.\s+(.+)/);
        if (numbered) {
          return (
            <div key={key} className="flex gap-2 pl-2">
              <span className="opacity-75 tabular-nums">{numbered[1]}.</span>
              <span>{renderInlineMarkdown(numbered[2], index)}</span>
            </div>
          );
        }

        return <p key={key}>{renderInlineMarkdown(line, index)}</p>;
      })}
    </div>
  );
}
