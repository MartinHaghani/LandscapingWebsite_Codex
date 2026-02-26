import type { HTMLAttributes, PropsWithChildren } from 'react';
import { cn } from '../../lib/cn';

export const Card = ({ className, children, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) => (
  <div
    className={cn(
      'rounded-2xl border border-white/15 bg-white/5 p-6 shadow-soft backdrop-blur-sm transition-colors duration-200 hover:border-brand/50',
      className
    )}
    {...props}
  >
    {children}
  </div>
);
