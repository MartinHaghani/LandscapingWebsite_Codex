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
    <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-white md:text-5xl">{title}</h2>
    {description ? <p className="mt-4 text-base text-white/72 md:text-lg">{description}</p> : null}
  </div>
);
