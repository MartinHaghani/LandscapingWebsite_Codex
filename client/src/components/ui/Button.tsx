import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import { cn } from '../../lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const baseStyles =
  'inline-flex min-h-[44px] items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-50';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-ink shadow-soft hover:bg-brand-muted',
  secondary: 'border border-stroke bg-surface text-ink hover:border-brand hover:text-ink',
  ghost: 'bg-transparent text-copy-muted hover:bg-brand/10 hover:text-ink'
};

export const Button = ({
  variant = 'primary',
  className,
  children,
  ...props
}: PropsWithChildren<ButtonProps>) => (
  <button className={cn(baseStyles, variants[variant], className)} {...props}>
    {children}
  </button>
);
