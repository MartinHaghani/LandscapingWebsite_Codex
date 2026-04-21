import { cn } from '../../lib/cn';
import { Button } from '../ui/Button';

interface QuoteGuideButtonProps {
  onClick: () => void;
  className?: string;
}

export const QuoteGuideButton = ({ onClick, className }: QuoteGuideButtonProps) => (
  <Button
    type="button"
    variant="secondary"
    onClick={onClick}
    aria-label="Open drawing guide"
    className={cn(
      'min-h-[48px] gap-2 rounded-full border border-white/70 bg-white/92 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink shadow-[0_18px_46px_-28px_rgba(15,23,42,0.72)] ring-4 ring-white/35 transition-all hover:-translate-y-0.5 hover:border-brand/35 hover:bg-white focus-visible:ring-brand/40',
      className
    )}
    data-quote-guide-button="true"
  >
    <span
      aria-hidden="true"
      className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand/12 text-sm font-bold text-brand"
    >
      ?
    </span>
    Guide
  </Button>
);
