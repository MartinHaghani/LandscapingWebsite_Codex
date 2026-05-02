import { cn } from '../../lib/cn';

const CheckIcon = () => (
  <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
    <path
      d="M3.25 8.15 6.45 11.2l6.3-6.4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

interface QuotePlanCardProps {
  title: string;
  eyebrow: string;
  badge?: string;
  price: string;
  priceSuffix: string;
  comparisonPrice?: string;
  comparisonLabel?: string;
  savingsText?: string;
  details: string[];
  selected: boolean;
  onSelect: () => void;
}

export const QuotePlanCard = ({
  title,
  eyebrow,
  badge,
  price,
  priceSuffix,
  comparisonPrice,
  comparisonLabel,
  savingsText,
  details,
  selected,
  onSelect
}: QuotePlanCardProps) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    onClick={onSelect}
    className={cn(
      'group flex h-full flex-col rounded-lg border bg-surface px-5 py-5 text-left transition-all duration-200 md:px-6 md:py-6',
      selected
        ? 'border-brand shadow-[0_18px_44px_-34px_rgba(50,159,91,0.85)]'
        : 'border-stroke hover:border-brand/55 hover:shadow-soft'
    )}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase text-brand">{eyebrow}</p>
        <h3 className="mt-2 text-2xl font-semibold text-ink">{title}</h3>
      </div>
      <span
        aria-hidden="true"
        className={cn(
          'grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-colors',
          selected ? 'border-brand bg-brand text-white' : 'border-stroke bg-surface-raised text-transparent'
        )}
      >
        <CheckIcon />
      </span>
    </div>

    <div className="mt-4 flex min-h-[2rem] flex-wrap gap-2">
      {badge ? (
        <span className="rounded-full border border-brand/45 bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
          {badge}
        </span>
      ) : null}
      {selected ? (
        <span className="rounded-full border border-ink/10 bg-ink px-2.5 py-1 text-xs font-semibold text-white">
          Selected
        </span>
      ) : null}
    </div>

    <div className="mt-6 flex flex-wrap items-end gap-x-2 gap-y-1">
      <p className="font-display text-4xl font-bold text-ink md:text-5xl">{price}</p>
      <p className="pb-1 text-sm font-medium text-copy-muted">{priceSuffix}</p>
    </div>

    {comparisonPrice ? (
      <p className="mt-2 text-sm font-medium text-copy-muted">
        <span className={cn(comparisonLabel === 'regular season price' && 'line-through decoration-[1.5px]')}>
          {comparisonPrice}
        </span>
        {comparisonLabel ? <span> {comparisonLabel}</span> : null}
      </p>
    ) : null}

    {savingsText ? <p className="mt-3 text-sm font-semibold text-brand">{savingsText}</p> : null}

    <div className="mt-5 flex flex-1 flex-col gap-3 text-sm text-copy-muted">
      {details.map((detail) => (
        <p key={detail} className="flex gap-2">
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
            <CheckIcon />
          </span>
          <span>{detail}</span>
        </p>
      ))}
    </div>
  </button>
);
