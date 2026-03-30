import { useEffect, useRef } from 'react';
import { cn } from '../../lib/cn';
import { getQuoteGuideSliderOffsetPercent, QUOTE_GUIDE_STEPS } from '../../lib/quoteGuide';

interface QuoteGuideModalProps {
  activeStepIndex: number;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

export const QuoteGuideModal = ({
  activeStepIndex,
  onClose,
  onPrevious,
  onNext
}: QuoteGuideModalProps) => {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const canGoPrevious = activeStepIndex > 0;
  const canGoNext = activeStepIndex < QUOTE_GUIDE_STEPS.length - 1;
  const sliderOffsetPercent = getQuoteGuideSliderOffsetPercent(activeStepIndex);
  const activeStep = QUOTE_GUIDE_STEPS[activeStepIndex] ?? QUOTE_GUIDE_STEPS[0];

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'ArrowLeft' && canGoPrevious) {
        event.preventDefault();
        onPrevious();
        return;
      }

      if (event.key === 'ArrowRight' && canGoNext) {
        event.preventDefault();
        onNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canGoNext, canGoPrevious, onClose, onNext, onPrevious]);

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center p-4 sm:p-6"
      data-quote-guide-modal="true"
    >
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_38%),linear-gradient(180deg,rgba(16,23,19,0.14),rgba(16,23,19,0.24))] backdrop-blur-[2px]"
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Map guide"
        className="quote-guide-modal-enter relative z-10 flex w-full max-w-[40rem] flex-col overflow-hidden rounded-[2rem] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(252,250,245,0.92))] p-4 shadow-[0_30px_80px_-36px_rgba(16,23,19,0.55)] backdrop-blur-xl sm:p-5"
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Close guide"
          className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full border border-stroke/60 bg-surface/60 text-copy-soft transition-colors hover:border-stroke hover:bg-surface/78 hover:text-copy-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <span aria-hidden="true" className="text-xl leading-none">
            ×
          </span>
        </button>

        <div
          key={activeStep.id}
          className="quote-guide-step-shell quote-guide-step-shell--animate relative flex min-h-[17rem] flex-1 overflow-hidden rounded-[1.6rem] border border-[#E5E1D6] bg-[linear-gradient(145deg,rgba(255,255,255,0.72),rgba(245,242,234,0.66))]"
          aria-label={`Guide step ${activeStepIndex + 1} of ${QUOTE_GUIDE_STEPS.length}`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(50,159,91,0.18),transparent_32%),radial-gradient(circle_at_82%_28%,rgba(16,23,19,0.08),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0))]" />
          <div className="absolute inset-[1.1rem] rounded-[1.2rem] border border-white/65 bg-white/14 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/35 bg-white/12 blur-sm" />
        </div>

        <div className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-3 sm:mt-5">
          <button
            type="button"
            onClick={onPrevious}
            disabled={!canGoPrevious}
            aria-label="Previous guide step"
            className={cn(
              'inline-flex min-h-[44px] items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
              canGoPrevious
                ? 'border-stroke bg-surface/70 text-copy-muted hover:border-brand/40 hover:text-ink'
                : 'border-stroke/60 bg-surface/45 text-copy-soft/80'
            )}
          >
            Back
          </button>

          <div className="flex items-center justify-center px-2">
            <div className="relative h-4 w-full max-w-[9rem]">
              <div className="absolute inset-x-0 top-1/2 h-[0.42rem] -translate-y-1/2 rounded-full bg-[#E7E1D4]" />
              <div
                className="quote-guide-slider-thumb absolute top-1/2 h-[0.9rem] w-[0.9rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/75 bg-brand shadow-[0_10px_18px_-12px_rgba(50,159,91,0.95)]"
                style={{ left: `${sliderOffsetPercent}%` }}
                aria-hidden="true"
              />
              <div className="absolute inset-x-2 top-1/2 flex -translate-y-1/2 justify-between">
                {QUOTE_GUIDE_STEPS.map((step, stepIndex) => (
                  <span
                    key={step.id}
                    className={cn(
                      'h-[0.36rem] w-[0.36rem] rounded-full transition-colors',
                      stepIndex <= activeStepIndex ? 'bg-brand/70' : 'bg-[#CDC7BA]'
                    )}
                    aria-hidden="true"
                  />
                ))}
              </div>
              <span className="sr-only">
                Step {activeStepIndex + 1} of {QUOTE_GUIDE_STEPS.length}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onNext}
            disabled={!canGoNext}
            aria-label="Next guide step"
            className={cn(
              'inline-flex min-h-[44px] items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
              canGoNext
                ? 'border-brand/20 bg-brand/12 text-ink hover:border-brand/45 hover:bg-brand/18'
                : 'border-stroke/60 bg-surface/45 text-copy-soft/80'
            )}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
