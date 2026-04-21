import { cn } from '../../lib/cn';

export type QuoteProgressStepId = 'address' | 'map' | 'review';
type QuoteProgressState = 'complete' | 'current' | 'upcoming';

const QUOTE_PROGRESS_STEPS = [
  {
    id: 'address',
    number: '01',
    title: 'Enter address'
  },
  {
    id: 'map',
    number: '02',
    title: 'Map your lawn'
  },
  {
    id: 'review',
    number: '03',
    title: 'Review quote'
  }
] as const satisfies ReadonlyArray<{
  id: QuoteProgressStepId;
  number: string;
  title: string;
}>;

const getStepIndex = (stepId: QuoteProgressStepId) =>
  QUOTE_PROGRESS_STEPS.findIndex((step) => step.id === stepId);

const getQuoteProgressState = (
  stepId: QuoteProgressStepId,
  currentStep: QuoteProgressStepId
): QuoteProgressState => {
  const stepIndex = getStepIndex(stepId);
  const currentIndex = getStepIndex(currentStep);

  if (stepIndex === currentIndex) {
    return 'current';
  }

  if (stepIndex < currentIndex) {
    return 'complete';
  }

  return 'upcoming';
};

interface QuoteProgressRailProps {
  currentStep: QuoteProgressStepId;
  compactOnMobile?: boolean;
}

export const QuoteProgressRail = ({ currentStep, compactOnMobile = false }: QuoteProgressRailProps) => {
  const currentIndex = getStepIndex(currentStep);
  const progressSteps = QUOTE_PROGRESS_STEPS.map((step) => {
    const state = getQuoteProgressState(step.id, currentStep);

    return {
      ...step,
      state,
      statusLabel:
        state === 'complete' ? 'Complete' : state === 'current' ? 'Current step' : 'Up next'
    };
  });
  const currentStepDetails = progressSteps[currentIndex] ?? progressSteps[0];

  return (
    <>
      {compactOnMobile ? (
        <div className="mt-8 rounded-lg border border-stroke bg-surface px-4 py-3 shadow-soft md:hidden">
          <p className="text-xs font-semibold uppercase text-brand">
            Step {currentIndex + 1} of {progressSteps.length}
          </p>
          <p className="mt-1 font-display text-lg font-semibold text-ink">{currentStepDetails.title}</p>
        </div>
      ) : null}
      <div
        className={cn(
          'relative mt-8 overflow-hidden rounded-[32px] border border-stroke bg-surface shadow-soft',
          compactOnMobile && 'hidden md:block'
        )}
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-mesh opacity-70" />
        <div className="relative px-5 py-5 md:px-6 md:py-6">
          <div className="relative">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute bottom-6 left-6 top-6 w-px bg-stroke/80 md:hidden"
            >
              <div
                className="w-full bg-brand transition-all duration-300"
                style={{
                  height:
                    currentStep === 'address'
                      ? '0%'
                      : currentStep === 'map'
                        ? '50%'
                        : '100%'
                }}
              />
            </div>

            <div
              aria-label="Quote progress"
              className="relative grid gap-5 md:grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)_4rem_minmax(0,1fr)] md:gap-0"
              data-quote-progress="true"
              role="list"
            >
              {progressSteps.flatMap((step, index) => [
                <div
                  key={step.id}
                  aria-current={step.state === 'current' ? 'step' : undefined}
                  className={cn(
                    'relative pl-16',
                    index === 0 ? 'md:pr-5' : 'md:pl-16 md:pr-0'
                  )}
                  data-step-state={step.state}
                  role="listitem"
                >
                  <div
                    className={cn(
                      'absolute left-0 top-1 flex h-12 w-12 items-center justify-center rounded-full border text-sm font-semibold tracking-[0.14em] transition-all duration-300',
                      step.state === 'current' &&
                        'border-brand bg-brand text-white shadow-[0_18px_40px_-28px_rgba(50,159,91,0.95)]',
                      step.state === 'complete' &&
                        'border-brand/50 bg-brand/12 text-brand shadow-[0_18px_40px_-30px_rgba(50,159,91,0.6)]',
                      step.state === 'upcoming' &&
                        'border-stroke bg-surface-raised text-copy-muted'
                    )}
                  >
                    {step.number}
                  </div>
                  <p
                    className={cn(
                      'text-[11px] font-semibold uppercase tracking-[0.16em]',
                      step.state === 'current' && 'text-brand',
                      step.state === 'complete' && 'text-copy',
                      step.state === 'upcoming' && 'text-copy-muted'
                    )}
                  >
                    {step.statusLabel}
                  </p>
                  <p className="mt-2 font-display text-xl font-semibold text-ink">{step.title}</p>
                </div>,
                index < progressSteps.length - 1 ? (
                  <div
                    key={`quote-progress-connector-${step.id}`}
                    aria-hidden="true"
                    className="hidden items-start justify-center pt-7 md:flex"
                  >
                    <div className="h-px w-full bg-stroke/80">
                      <div
                        className={cn(
                          'h-full bg-brand transition-all duration-300',
                          currentIndex > index ? 'w-full' : 'w-0'
                        )}
                      />
                    </div>
                  </div>
                ) : null
              ])}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
