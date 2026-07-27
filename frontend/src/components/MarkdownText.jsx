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

        const numbered = line.match(/^(\d+)\.\s+(.+)/);

        if (numbered) {
          return <div key={index} className="flex gap-2 pl-2"><span className="opacity-75">{numbered[1]}.</span><span>{renderInlineMarkdown(numbered[2])}</span></div>;
        }

        return <p key={index}>{line ? renderInlineMarkdown(line) : '\u00A0'}</p>;
      })}
    </div>
  );
}
