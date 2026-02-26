import type { PropsWithChildren } from 'react';

export const Badge = ({ children }: PropsWithChildren) => (
  <span className="inline-flex items-center rounded-full border border-brand/50 bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-brand">
    {children}
  </span>
);
