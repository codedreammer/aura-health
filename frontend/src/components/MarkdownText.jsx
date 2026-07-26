const renderInlineMarkdown = (text) => text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => (
  part.startsWith('**') && part.endsWith('**')
    ? <strong key={index}>{part.slice(2, -2)}</strong>
    : part
));

export default function MarkdownText({ content }) {
  return (
    <div className="space-y-1 break-words leading-relaxed">
      {content.split('\n').map((line, index) => {
        const bullet = line.match(/^[-*]\s+(.+)/);

        if (bullet) {
          return <div key={index} className="flex gap-2"><span>•</span><span>{renderInlineMarkdown(bullet[1])}</span></div>;
        }

        return <p key={index}>{line ? renderInlineMarkdown(line) : '\u00A0'}</p>;
      })}
    </div>
  );
}
