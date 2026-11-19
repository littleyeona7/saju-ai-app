import { Fragment, type ReactNode } from 'react';
import { cn } from '../lib/utils';

function inline(text: string, keyPrefix: string): ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|__[^_]+__|_[^_\n]+_|`[^`]+`)/g);
  return tokens.filter((token) => token !== '').map((token, index) => {
    const key = `${keyPrefix}-${index}`;
    if (token.startsWith('**') && token.endsWith('**')) {
      return (
        <strong key={key} className="font-semibold text-slate-50">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith('__') && token.endsWith('__')) {
      return (
        <strong key={key} className="font-semibold text-slate-50">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith('`') && token.endsWith('`')) {
      return (
        <code key={key} className="rounded bg-white/10 px-1 py-0.5 text-[12px] text-gold">
          {token.slice(1, -1)}
        </code>
      );
    }
    if ((token.startsWith('*') && token.endsWith('*')) || (token.startsWith('_') && token.endsWith('_'))) {
      return (
        <em key={key} className="text-slate-300">
          {token.slice(1, -1)}
        </em>
      );
    }
    return <Fragment key={key}>{token}</Fragment>;
  });
}

/** 스트리밍 중에도 안전하게 그릴 수 있는 가벼운 마크다운 렌더러 */
export function Markdown({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let index = 0;
  let key = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const content = heading[2];
      const size = level <= 2 ? 'text-[15px]' : level === 3 ? 'text-[14px]' : 'text-[13px]';
      blocks.push(
        <h4 key={`h-${key++}`} className={cn('mt-1 mb-1 font-semibold text-gold', size)}>
          {inline(content, `h${key}`)}
        </h4>,
      );
      index += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      blocks.push(<hr key={`hr-${key++}`} className="my-2.5 border-white/10" />);
      index += 1;
      continue;
    }

    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*•]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*•]\s+/, ''));
        index += 1;
      }
      blocks.push(
        <ul key={`ul-${key++}`} className="my-1 space-y-1 pl-1">
          {items.map((item, itemIndex) => (
            <li key={itemIndex} className="flex gap-1.5 text-[13px] leading-relaxed text-slate-200">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-gold/70" />
              <span className="min-w-0">{inline(item, `li${key}-${itemIndex}`)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ''));
        index += 1;
      }
      blocks.push(
        <ol key={`ol-${key++}`} className="my-1 space-y-1 pl-1">
          {items.map((item, itemIndex) => (
            <li key={itemIndex} className="flex gap-1.5 text-[13px] leading-relaxed text-slate-200">
              <span className="shrink-0 text-[11px] font-semibold text-gold/80">{itemIndex + 1}.</span>
              <span className="min-w-0">{inline(item, `oli${key}-${itemIndex}`)}</span>
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoted: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoted.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push(
        <blockquote
          key={`q-${key++}`}
          className="my-1.5 border-l-2 border-gold/40 pl-2.5 text-[12.5px] leading-relaxed text-slate-400"
        >
          {inline(quoted.join(' '), `q${key}`)}
        </blockquote>,
      );
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,6})\s+/.test(lines[index]) &&
      !/^\s*[-*•]\s+/.test(lines[index]) &&
      !/^\s*\d+\.\s+/.test(lines[index]) &&
      !/^>\s?/.test(lines[index]) &&
      !/^(-{3,}|\*{3,})$/.test(lines[index].trim())
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push(
      <p key={`p-${key++}`} className="my-1 text-[13px] leading-[1.65] text-slate-200">
        {inline(paragraph.join(' '), `p${key}`)}
      </p>,
    );
  }

  return <div className={cn('break-words', className)}>{blocks}</div>;
}
