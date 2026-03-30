import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';

interface SustainabilityMetric {
  label: string;
  helper: string;
  electricValue: string;
  gasValue: string;
  electricBarPercent: number;
  gasBarPercent: number;
}

const metrics: SustainabilityMetric[] = [
  {
    label: 'Point-of-use exhaust',
    helper: 'No on-board engine combustion while mowing on site.',
    electricValue: '0 exhaust while mowing',
    gasValue: 'Combustion exhaust on site',
    electricBarPercent: 0,
    gasBarPercent: 100
  },
  {
    label: 'Noise at 25 ft',
    helper: 'Measured field averages from a large mower dataset.',
    electricValue: '65.5 dBA',
    gasValue: '72.5 dBA',
    electricBarPercent: 90.3,
    gasBarPercent: 100
  },
  {
    label: '10-year lifecycle CO2e (push mower study)',
    helper: 'Peer-reviewed lifecycle comparison; local grid mix still matters.',
    electricValue: '354 kg',
    gasValue: '707 kg',
    electricBarPercent: 50.1,
    gasBarPercent: 100
  }
];

interface MetricBarRowProps {
  label: string;
  value: string;
  widthPercent: number;
  tone: 'electric' | 'gas';
}

const MetricBarRow = ({ label, value, widthPercent, tone }: MetricBarRowProps) => {
  const isElectric = tone === 'electric';

  return (
    <div className="grid gap-2 sm:grid-cols-[92px_minmax(0,1fr)] sm:items-center sm:gap-3">
      <div className="flex items-center justify-between gap-3 sm:block">
        <p
          className={`text-[0.68rem] font-semibold uppercase tracking-[0.16em] ${
            isElectric ? 'text-brand' : 'text-copy-soft'
          }`}
        >
          {label}
        </p>
        <p className="text-sm font-medium text-copy-muted sm:mt-1">{value}</p>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-canvas-muted/80">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${
            isElectric ? 'bg-brand' : 'bg-ink/26'
          }`}
          style={{ width: `${Math.max(0, Math.min(widthPercent, 100))}%` }}
        />
      </div>
    </div>
  );
};

export const HomeSustainabilitySection = () => (
  <section className="relative border-b border-stroke bg-surface">
    <div
      className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-brand/10 via-brand/5 to-transparent"
      aria-hidden="true"
    />
    <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-16 md:grid-cols-[0.95fr_1.05fr] md:px-8 md:py-20">
      <div className="relative">
        <Badge>Why Electric</Badge>
        <h2 className="mt-4 max-w-xl font-display text-3xl font-bold tracking-tight text-ink md:text-5xl">
          Cleaner, quieter lawn care without the gas tradeoffs.
        </h2>
        <p className="mt-5 max-w-xl text-base text-copy-muted md:text-lg">
          Battery-electric mowing removes exhaust where the work happens, runs quieter around the
          property, and can lower lifecycle emissions versus gas equipment. It is a cleaner, calmer
          fit for modern neighborhoods that still expect premium curb appeal.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {['No on-site exhaust', 'Lower neighbor noise', 'Lower lifecycle emissions'].map((item) => (
            <div
              key={item}
              className="rounded-full border border-brand/20 bg-brand/10 px-4 py-2 text-sm font-medium text-ink"
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      <Card className="relative bg-surface-raised p-5 md:p-6">
        <div className="space-y-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-2xl border border-stroke/80 bg-white/75 p-4 shadow-[0_1px_0_rgba(16,23,19,0.03)]"
            >
              <div className="max-w-xl">
                <h3 className="text-sm font-semibold text-ink md:text-[0.98rem]">{metric.label}</h3>
                <p className="mt-1 text-xs text-copy-soft">{metric.helper}</p>
              </div>
              <div className="mt-4 space-y-3">
                <MetricBarRow
                  label="Electric"
                  value={metric.electricValue}
                  widthPercent={metric.electricBarPercent}
                  tone="electric"
                />
                <MetricBarRow
                  label="Gas"
                  value={metric.gasValue}
                  widthPercent={metric.gasBarPercent}
                  tone="gas"
                />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-5 text-xs leading-relaxed text-copy-soft">
          Based on field noise measurements and peer-reviewed lifecycle modeling. "Zero emissions"
          refers to exhaust at the point of use; lifecycle impact varies by equipment and local
          electricity mix.
        </p>
      </Card>
    </div>
  </section>
);
