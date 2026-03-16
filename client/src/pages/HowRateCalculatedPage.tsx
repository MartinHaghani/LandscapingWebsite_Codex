import { Card } from '../components/ui/Card';
import { SectionTitle } from '../components/ui/SectionTitle';
import { quotePricing } from '../lib/quote';

export const HowRateCalculatedPage = () => (
  <div className="mx-auto w-full max-w-4xl px-4 py-16 md:px-8 md:py-20">
    <SectionTitle
      badge="Pricing"
      title="How the instant quote is calculated"
      description="Autoscape pricing uses a deterministic metric formula with obstacle subtraction."
    />

    <Card className="mt-10 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Formula</h2>
        <p className="mt-3 text-sm text-white/75">
          <code className="rounded bg-white/10 px-2 py-1 text-xs text-white">
            perSession = max(20 + 0.05*A + 0.10*P + 1.0*D, 50)
          </code>
        </p>
        <p className="mt-2 text-sm text-white/75">
          <code className="rounded bg-white/10 px-2 py-1 text-xs text-white">
            fullSeason = perSession * sessions, seasonalDiscounted = fullSeason * (1 - discountRate)
          </code>
        </p>
      </div>

      <div className="space-y-2 text-sm text-white/80">
        <p>
          <span className="font-semibold text-white">Base fee:</span> ${quotePricing.baseFee.toFixed(2)}
        </p>
        <p>
          <span className="font-semibold text-white">Area rate:</span> ${quotePricing.areaRate.toFixed(3)} per m2
        </p>
        <p>
          <span className="font-semibold text-white">Perimeter rate:</span> $
          {quotePricing.perimeterRate.toFixed(2)} per m
        </p>
        <p>
          <span className="font-semibold text-white">Distance rate:</span> ${quotePricing.distanceRate.toFixed(2)} per km
        </p>
        <p>
          <span className="font-semibold text-white">Seasonal discount (default):</span>{' '}
          {(quotePricing.defaultSeasonalDiscountRate * 100).toFixed(0)}%
        </p>
      </div>

      <div className="space-y-3 text-sm text-white/75">
        <p>
          Pricing is computed in metric units internally. The instant quote page can still display area and perimeter
          in metric or imperial.
        </p>
        <p>
          Sessions per season by cadence: weekly uses 26 sessions and bi-weekly uses 14 sessions.
        </p>
        <p>
          Service polygons define where work is performed. Obstacle polygons are subtracted from the service geometry.
          Only the final effective service footprint is billed.
        </p>
        <p>
          <code className="rounded bg-white/10 px-2 py-1 text-xs text-white">D</code> is the nearest active base-station distance in
          kilometers and is used internally for pricing only.
        </p>
        <p>
          Perimeter is measured on the final cutout geometry, including hole boundaries created by interior obstacles.
        </p>
      </div>
    </Card>
  </div>
);
