import { getQuoteTotal, getSeasonalPricing } from '../../lib/quote';

const SAMPLE_LAWN_SQFT = 3000;
const SAMPLE_LAWN_AREA_M2 = SAMPLE_LAWN_SQFT * 0.09290304;
const SAMPLE_LAWN_PERIMETER_M = 67.06;
const SAMPLE_DISTANCE_KM = 0;
const COMPETITOR_RATE_PER_VISIT = 55;

const autoscapePerVisit = getQuoteTotal(
  {
    areaM2: SAMPLE_LAWN_AREA_M2,
    perimeterM: SAMPLE_LAWN_PERIMETER_M
  },
  SAMPLE_DISTANCE_KM
);
const autoscapeSeasonal = getSeasonalPricing(autoscapePerVisit, 'weekly');
const competitorSeasonTotal = COMPETITOR_RATE_PER_VISIT * autoscapeSeasonal.sessionsMax;
const SAMPLE_LAWN_FILL_PATH = [
  'M98 38',
  'H236',
  'L274 54',
  'H320',
  'L350 84',
  'V170',
  'L376 202',
  'V432',
  'L344 470',
  'H296',
  'L280 494',
  'H148',
  'L112 474',
  'L82 346',
  'V106',
  'L98 38',
  'Z',
  'M190 154',
  'H290',
  'L306 168',
  'V244',
  'H266',
  'V494',
  'H226',
  'V244',
  'H190',
  'Z'
].join(' ');
const SAMPLE_LAWN_OUTLINE_PATH = [
  'M98 38',
  'H236',
  'L274 54',
  'H320',
  'L350 84',
  'V170',
  'L376 202',
  'V432',
  'L344 470',
  'H296',
  'L280 494',
  'H148',
  'L112 474',
  'L82 346',
  'V106',
  'L98 38',
  'Z',
  'M190 154',
  'H290',
  'L306 168',
  'V244',
  'H266',
  'V494',
  'M226 494',
  'V244',
  'H190',
  'V154'
].join(' ');

const formatDollars = (value: number) => `$${Math.round(value).toLocaleString('en-US')}`;

const SampleLawnGraphic = () => (
  <svg
    viewBox="0 0 420 560"
    className="mx-auto h-auto w-full max-w-[15.5rem] overflow-visible text-brand lg:max-w-[16rem]"
    preserveAspectRatio="xMidYMid meet"
    aria-hidden="true"
    focusable="false"
  >
    <defs>
      <filter
        id="home-pricing-lawn-shadow"
        x="-20%"
        y="-22%"
        width="140%"
        height="144%"
        colorInterpolationFilters="sRGB"
      >
        <feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#101713" floodOpacity="0.12" />
        <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#101713" floodOpacity="0.06" />
      </filter>
    </defs>

    <g filter="url(#home-pricing-lawn-shadow)">
      <path d={SAMPLE_LAWN_FILL_PATH} fill="currentColor" fillRule="evenodd" />
    </g>

    <path
      d={SAMPLE_LAWN_OUTLINE_PATH}
      fill="none"
      stroke="rgba(255,255,255,0.66)"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.2"
      vectorEffect="non-scaling-stroke"
    />
  </svg>
);

export const HomePricingComparisonSection = () => (
  <section
    className="relative overflow-hidden border-b border-stroke bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,244,238,0.72))]"
    data-home-pricing-comparison="true"
  >
    <div className="mx-auto w-full max-w-6xl px-4 py-14 text-center md:px-8 md:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Price Check</p>
      <h2 className="mx-auto mt-4 max-w-3xl font-display text-3xl font-bold leading-tight text-ink md:text-5xl">
        Save with Autoscape
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-copy-muted md:text-lg">
        Get a cheaper visit rate and 20% off when you choose the seasonal plan.
      </p>

      <div
        className="mx-auto mt-12 grid max-w-6xl gap-4 md:grid-cols-[minmax(0,0.62fr)_minmax(0,1.38fr)] md:items-stretch md:gap-5"
        data-home-pricing-band="true"
      >
        <div
          className="h-full px-2 py-4 text-center md:px-4 md:py-5"
          data-home-pricing-context="true"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-copy-soft">
            Sample lawn
          </p>
          <div
            className="mx-auto mt-5 flex w-full max-w-[10rem] items-center justify-center sm:max-w-[11rem] md:max-w-[10.5rem]"
            data-home-pricing-lawn="true"
          >
            <SampleLawnGraphic />
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-stroke/70 pt-4 text-left">
            <div>
              <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-copy-soft">
                Size
              </dt>
              <dd className="mt-1 text-xs font-medium text-copy-muted">3,000 sq ft lawn</dd>
            </div>
            <div>
              <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-copy-soft">
                Schedule
              </dt>
              <dd className="mt-1 text-xs font-medium text-copy-muted">
                {autoscapeSeasonal.sessionsMax} weekly visits
              </dd>
            </div>
          </dl>
        </div>

        <div
          className="flex h-full flex-col rounded-lg border-y border-stroke/80 bg-white/70 p-4 text-left shadow-[0_20px_44px_-40px_rgba(16,23,19,0.28)] sm:p-5 md:border md:bg-surface/90"
          data-home-pricing-panel="true"
        >
          <div
            className="grid flex-1 grid-cols-[minmax(6.5rem,0.72fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-2 gap-y-4 sm:grid-cols-[minmax(8rem,0.72fr)_minmax(0,1fr)_minmax(0,1fr)] sm:gap-x-4"
            data-home-pricing-standard-grid="true"
          >
            <div className="border-b border-stroke pb-3" />
            <p className="border-b border-stroke pb-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-brand sm:text-sm">
              Autoscape
            </p>
            <p className="border-b border-stroke pb-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-copy-soft sm:text-sm">
              Local competitors
            </p>

            <div className="pt-1">
              <p className="text-base font-semibold text-ink sm:text-lg">Per visit</p>
            </div>
            <div className="pt-1 text-center">
              <p className="text-3xl font-bold tracking-tight text-brand sm:text-4xl">
                {formatDollars(autoscapePerVisit)}
              </p>
            </div>
            <div className="pt-1 text-center">
              <p className="text-3xl font-bold tracking-tight text-copy-soft sm:text-4xl">
                {formatDollars(COMPETITOR_RATE_PER_VISIT)}
              </p>
            </div>

            <div className="border-t border-stroke pt-4">
              <p className="text-base font-semibold text-ink sm:text-lg">Per season</p>
            </div>
            <div
              className="relative border-t border-stroke pt-4 text-center"
              data-home-pricing-discount-cell="true"
            >
              <p className="text-3xl font-bold tracking-tight text-brand sm:text-4xl">
                {formatDollars(autoscapeSeasonal.seasonalDiscountedTotal)}
              </p>
              <span
                className="absolute right-0 top-0 -translate-y-1/2 border border-brand/30 bg-surface px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.1em] text-brand shadow-[0_10px_18px_-18px_rgba(16,23,19,0.35)] sm:right-1 sm:px-2 sm:text-[0.6rem]"
                data-home-pricing-discount-badge="true"
              >
                20% off
              </span>
            </div>
            <div className="border-t border-stroke pt-4 text-center">
              <p className="text-3xl font-bold tracking-tight text-copy-soft sm:text-4xl">
                {formatDollars(competitorSeasonTotal)}
              </p>
            </div>
          </div>

          <p className="mt-6 text-xs leading-5 text-copy-soft">
            Benchmark uses the current public posted weekly mowing rate. Taxes, extras, drawn
            area, perimeter, cadence, and service distance can change a final quote.
          </p>
        </div>
      </div>
    </div>
  </section>
);
