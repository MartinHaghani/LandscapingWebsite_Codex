import { Card } from './Card';

interface StatItem {
  label: string;
  value: string;
}

interface StatsBarProps {
  items: StatItem[];
}

export const StatsBar = ({ items }: StatsBarProps) => (
  <Card className="grid grid-cols-1 gap-4 bg-black/75 p-4 md:grid-cols-3">
    {items.map((item) => (
      <div key={item.label}>
        <p className="text-xs uppercase tracking-[0.16em] text-white/55">{item.label}</p>
        <p className="mt-1 text-lg font-semibold text-white">{item.value}</p>
      </div>
    ))}
  </Card>
);
