import { Card } from './Card';

interface StatItem {
  label: string;
  value: string;
}

interface StatsBarProps {
  items: StatItem[];
}

export const StatsBar = ({ items }: StatsBarProps) => (
  <Card className="grid grid-cols-1 gap-2.5 border-brand/20 bg-surface-raised px-4 py-3.5 md:grid-cols-3 md:gap-3 md:px-5 md:py-3">
    {items.map((item) => (
      <div key={item.label}>
        <p className="text-[0.65rem] uppercase tracking-[0.16em] text-copy-soft">{item.label}</p>
        <p className="mt-0.5 text-base font-semibold text-ink md:text-[1.02rem]">{item.value}</p>
      </div>
    ))}
  </Card>
);
