import type { HTMLAttributes, PropsWithChildren } from 'react';
import { cn } from '../../lib/cn';

export const Card = ({ className, children, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) => (
  <div
    className={cn(
      'rounded-2xl border border-stroke bg-surface p-6 shadow-soft transition-colors duration-200 hover:border-brand/45',
      className
    )}
    {...props}
  >
    {children}
  </div>
);
