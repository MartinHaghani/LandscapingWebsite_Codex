import type { PropsWithChildren } from 'react';
import { Badge } from './Badge';

interface SectionTitleProps {
  badge: string;
  title: string;
  description?: string;
}

export const SectionTitle = ({ badge, title, description }: PropsWithChildren<SectionTitleProps>) => (
  <div className="max-w-3xl">
    <Badge>{badge}</Badge>
    <h2 className="mt-4 text-balance font-display text-[1.7rem] font-bold leading-tight tracking-tight text-ink md:text-5xl md:leading-tight">
      {title}
    </h2>
    {description ? (
      <p className="mt-3 text-[0.95rem] text-copy-muted md:mt-4 md:text-lg">{description}</p>
    ) : null}
  </div>
);
