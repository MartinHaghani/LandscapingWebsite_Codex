import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import { cn } from '../../lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const baseStyles =
  'inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-black shadow-soft hover:bg-brand/90',
  secondary: 'border border-white/35 bg-transparent text-white hover:border-brand hover:text-brand',
  ghost: 'bg-transparent text-white hover:bg-white/10'
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
