import type { ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { legalDocumentBySlug, legalDocuments } from '../content/legal';
import { Card } from '../components/ui/Card';

const inlinePattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

const renderLink = (label: string, href: string, key: string) => {
  const className = 'font-semibold text-brand underline underline-offset-4 hover:text-brand/80';

  if (href.startsWith('/')) {
    return (
      <Link key={key} to={href} className={className}>
        {label}
      </Link>
    );
  }

  return (
    <a
      key={key}
      href={href}
      className={className}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
    >
      {label}
    </a>
  );
};

const renderInlineMarkdown = (text: string, keyPrefix: string) => {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlinePattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}-${match.index}`;
    const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);

    if (linkMatch) {
      nodes.push(renderLink(linkMatch[1], linkMatch[2], key));
    } else if (token.startsWith('**')) {
      nodes.push(
        <strong key={key} className="font-semibold text-ink">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`')) {
      nodes.push(
        <code key={key} className="rounded bg-surface-muted px-1.5 py-0.5 text-[0.92em] text-ink">
          {token.slice(1, -1)}
        </code>
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
};

const slugifyHeading = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

const renderMarkdown = (content: string) => {
  const nodes: ReactNode[] = [];
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  let paragraph: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return;
    }

    const text = paragraph.join(' ');
    const index = nodes.length;
    nodes.push(
      <p key={`paragraph-${index}`} className="text-sm leading-7 text-copy-muted md:text-base">
        {renderInlineMarkdown(text, `paragraph-${index}`)}
      </p>
    );
    paragraph = [];
  };

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }

    const index = nodes.length;
    nodes.push(
      <ul key={`list-${index}`} className="list-disc space-y-2 pl-5 text-sm leading-7 text-copy-muted md:text-base">
        {listItems.map((item, itemIndex) => (
          <li key={`${index}-${itemIndex}`}>
            {renderInlineMarkdown(item, `list-${index}-${itemIndex}`)}
          </li>
        ))}
      </ul>
    );
    listItems = [];
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      return;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const id = slugifyHeading(text);
      const index = nodes.length;

      if (level === 1) {
        nodes.push(
          <h1 key={`heading-${index}`} id={id} className="font-display text-4xl font-bold leading-tight text-ink md:text-5xl">
            {renderInlineMarkdown(text, `heading-${index}`)}
          </h1>
        );
        return;
      }

      if (level === 2) {
        nodes.push(
          <h2 key={`heading-${index}`} id={id} className="pt-3 text-2xl font-semibold text-ink">
            {renderInlineMarkdown(text, `heading-${index}`)}
          </h2>
        );
        return;
      }

      nodes.push(
        <h3 key={`heading-${index}`} id={id} className="pt-2 text-xl font-semibold text-ink">
          {renderInlineMarkdown(text, `heading-${index}`)}
        </h3>
      );
      return;
    }

    if (line.startsWith('- ')) {
      flushParagraph();
      listItems.push(line.slice(2).trim());
      return;
    }

    flushList();
    paragraph.push(line);
  });

  flushParagraph();
  flushList();

  return nodes;
};

const LegalIndex = () => (
  <div className="mx-auto w-full max-w-7xl px-4 py-14 md:px-8 md:py-20">
    <div className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Legal</p>
      <h1 className="mt-3 font-display text-4xl font-bold leading-tight text-ink md:text-5xl">
        Autoscape legal documents
      </h1>
      <p className="mt-4 text-sm leading-7 text-copy-muted md:text-base">
        These website legal drafts are prepared for attorney review and are based on the current
        Autoscape quote, account, payment, and service-area flows.
      </p>
    </div>

    <div className="mt-10 grid gap-4 md:grid-cols-2">
      {legalDocuments.map((document) => (
        <Link key={document.slug} to={`/legal/${document.slug}`} className="group">
          <Card className="h-full rounded-lg bg-surface transition-colors group-hover:border-brand/45">
            <h2 className="text-xl font-semibold text-ink">{document.title}</h2>
            <p className="mt-3 text-sm leading-6 text-copy-muted">{document.summary}</p>
          </Card>
        </Link>
      ))}
    </div>
  </div>
);

export const LegalPage = () => {
  const { slug } = useParams();

  if (!slug) {
    return <LegalIndex />;
  }

  const document = legalDocumentBySlug.get(slug);
  if (!document) {
    return <Navigate to="/legal" replace />;
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12 md:px-8 md:py-16">
      <Link
        to="/legal"
        className="text-sm font-semibold text-brand underline underline-offset-4 hover:text-brand/80"
      >
        Back to legal documents
      </Link>
      <article className="legal-document mt-8 space-y-5 rounded-lg border border-stroke bg-surface px-5 py-7 shadow-soft md:px-8 md:py-10">
        {renderMarkdown(document.content)}
      </article>
    </div>
  );
};

