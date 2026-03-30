import { Button } from '../ui/Button';
import { cn } from '../../lib/cn';

interface QuoteDoneButtonProps {
  disabled: boolean;
  onClick: () => void;
  className?: string;
}

export const QuoteDoneButton = ({
  disabled,
  onClick,
  className
}: QuoteDoneButtonProps) => (
  <Button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'min-h-[60px] gap-3 rounded-full border border-white/65 bg-brand px-7 py-4 text-sm font-semibold uppercase tracking-[0.16em] text-white shadow-[0_26px_60px_-24px_rgba(15,23,42,0.82)] ring-4 ring-white/45 transition-all hover:-translate-y-0.5 hover:bg-brand-muted hover:shadow-[0_32px_72px_-24px_rgba(15,23,42,0.88)] disabled:border-stroke disabled:bg-surface disabled:text-copy-muted disabled:ring-0 disabled:shadow-soft',
      className
    )}
    data-quote-done-button="true"
  >
    <span
      aria-hidden="true"
      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/22 text-base shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22)]"
    >
      ✓
    </span>
    Done
  </Button>
);
