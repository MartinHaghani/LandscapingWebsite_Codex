import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import {
  getQuoteGuideInstructionContent,
  getQuoteGuideStep,
  QUOTE_GUIDE_STEPS,
  type QuoteGuideInstructionKey
} from '../../lib/quoteGuide';
import { QuoteGuideStepDrawDemo } from './QuoteGuideStepDrawDemo';
import { QuoteGuideStepMultiZoneDemo } from './QuoteGuideStepMultiZoneDemo';
import { QuoteGuideStepObstacleDemo } from './QuoteGuideStepObstacleDemo';

interface QuoteGuideModalProps {
  activeStepIndex: number;
  onClose: () => void;
  onDone: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

const QUOTE_GUIDE_STEP_TRANSITION_OUT_DURATION_MS = 520;
const QUOTE_GUIDE_STEP_TRANSITION_IN_DURATION_MS = 760;
const QUOTE_GUIDE_MODAL_DONE_EXIT_DURATION_MS = 920;
type QuoteGuideStepTransitionPhase = 'idle' | 'out' | 'in';
type QuoteGuideModalExitPhase = 'idle' | 'closing';

export const QuoteGuideModal = ({
  activeStepIndex,
  onClose,
  onDone,
  onPrevious,
  onNext
}: QuoteGuideModalProps) => {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const transitionSettleTimerRef = useRef<number | null>(null);
  const doneExitTimerRef = useRef<number | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [renderedStepIndex, setRenderedStepIndex] = useState(activeStepIndex);
  const [stepTransitionPhase, setStepTransitionPhase] =
    useState<QuoteGuideStepTransitionPhase>('idle');
  const [modalExitPhase, setModalExitPhase] = useState<QuoteGuideModalExitPhase>('idle');
  const activeStep = getQuoteGuideStep(renderedStepIndex);
  const transitionLocked =
    stepTransitionPhase !== 'idle' || modalExitPhase === 'closing';
  const isFinalStep = renderedStepIndex === QUOTE_GUIDE_STEPS.length - 1;
  const canGoPrevious = renderedStepIndex > 0 && !transitionLocked;
  const canGoNext = renderedStepIndex < QUOTE_GUIDE_STEPS.length - 1 && !transitionLocked;
  const [instructionKey, setInstructionKey] = useState<QuoteGuideInstructionKey>(
    activeStep.defaultInstructionKey
  );
  const instructionContent = getQuoteGuideInstructionContent(
    renderedStepIndex,
    instructionKey
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };

    updatePreference();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updatePreference);
      return () => mediaQuery.removeEventListener('change', updatePreference);
    }

    mediaQuery.addListener(updatePreference);
    return () => mediaQuery.removeListener(updatePreference);
  }, []);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    return () => {
      if (doneExitTimerRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(doneExitTimerRef.current);
        doneExitTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setInstructionKey(activeStep.defaultInstructionKey);
  }, [activeStep.defaultInstructionKey, activeStep.id]);

  useEffect(() => {
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }

    if (transitionSettleTimerRef.current !== null) {
      window.clearTimeout(transitionSettleTimerRef.current);
      transitionSettleTimerRef.current = null;
    }

    if (activeStepIndex === renderedStepIndex) {
      setStepTransitionPhase('idle');
      return;
    }

    if (prefersReducedMotion || typeof window === 'undefined') {
      setRenderedStepIndex(activeStepIndex);
      setStepTransitionPhase('idle');
      return;
    }

    setStepTransitionPhase('out');

    transitionTimerRef.current = window.setTimeout(() => {
      setRenderedStepIndex(activeStepIndex);
      setStepTransitionPhase('in');

      transitionSettleTimerRef.current = window.setTimeout(() => {
        setStepTransitionPhase('idle');
        transitionSettleTimerRef.current = null;
      }, QUOTE_GUIDE_STEP_TRANSITION_IN_DURATION_MS);

      transitionTimerRef.current = null;
    }, QUOTE_GUIDE_STEP_TRANSITION_OUT_DURATION_MS);

    return () => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }

      if (transitionSettleTimerRef.current !== null) {
        window.clearTimeout(transitionSettleTimerRef.current);
        transitionSettleTimerRef.current = null;
      }
    };
  }, [activeStepIndex, prefersReducedMotion, renderedStepIndex]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (modalExitPhase !== 'closing') {
          onClose();
        }
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
  }, [canGoNext, canGoPrevious, modalExitPhase, onClose, onNext, onPrevious]);

  const handleGuideDone = () => {
    if (modalExitPhase === 'closing') {
      return;
    }

    if (prefersReducedMotion || typeof window === 'undefined') {
      onDone();
      return;
    }

    setModalExitPhase('closing');
    doneExitTimerRef.current = window.setTimeout(() => {
      doneExitTimerRef.current = null;
      onDone();
    }, QUOTE_GUIDE_MODAL_DONE_EXIT_DURATION_MS);
  };

  return (
    <div
      className={cn(
        'absolute inset-0 z-30 flex items-center justify-center p-4 sm:p-6',
        modalExitPhase === 'closing' && 'quote-guide-modal-host--done-exit'
      )}
      data-quote-guide-modal="true"
      data-quote-guide-modal-exit-phase={modalExitPhase}
    >
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_28%),linear-gradient(180deg,rgba(8,12,10,0.34),rgba(8,12,10,0.58))] backdrop-blur-[6px]"
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Map guide"
        className="quote-guide-modal-enter relative z-10 flex w-full max-w-[41rem] flex-col overflow-hidden rounded-[1.55rem] border border-[#DCE6DA] bg-white shadow-[0_38px_96px_-40px_rgba(6,10,8,0.72)]"
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={() => {
            if (modalExitPhase !== 'closing') {
              onClose();
            }
          }}
          aria-label="Close guide"
          className="absolute right-3 top-3 z-30 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-copy-soft shadow-[0_10px_24px_-20px_rgba(16,23,19,0.34)] transition-colors hover:bg-white hover:text-copy-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <span aria-hidden="true" className="text-xl leading-none">
            ×
          </span>
        </button>

        <div
          className="quote-guide-media-unit quote-guide-media-unit--fade flex flex-col bg-[#F3F7F1]"
          data-quote-guide-media-unit="true"
        >
          <div
            key={activeStep.id}
            className={cn(
              'quote-guide-step-shell quote-guide-step-shell--animate relative flex min-h-[25.5rem] flex-1 overflow-hidden bg-[#F3F7F1]',
              stepTransitionPhase === 'out'
                ? 'quote-guide-step-shell--phase-out'
                : stepTransitionPhase === 'in'
                  ? 'quote-guide-step-shell--phase-in'
                  : 'quote-guide-step-shell--phase-idle'
            )}
            aria-label={activeStep.ariaLabel}
            data-quote-guide-step-kind={activeStep.kind}
            data-quote-guide-step-transition-phase={stepTransitionPhase}
          >
            {activeStep.kind === 'draw-demo' ? (
              <QuoteGuideStepDrawDemo
                ariaLabel={activeStep.ariaLabel}
                onInstructionStateChange={(state) =>
                  setInstructionKey(state === 'edit' ? 'step-1-edit' : 'step-1-draw')
                }
              />
            ) : activeStep.kind === 'multi-zone-edit-demo' ? (
              <QuoteGuideStepMultiZoneDemo
                ariaLabel={activeStep.ariaLabel}
                onInstructionStateChange={(state) =>
                  setInstructionKey(
                    state === 'add'
                      ? 'step-2-add'
                      : state === 'remove'
                        ? 'step-2-remove'
                        : 'step-2-draw'
                  )
                }
              />
            ) : activeStep.kind === 'obstacle-draw-demo' ? (
              <QuoteGuideStepObstacleDemo ariaLabel={activeStep.ariaLabel} />
            ) : (
              <>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(50,159,91,0.18),transparent_32%),radial-gradient(circle_at_82%_28%,rgba(16,23,19,0.08),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0))]" />
                <div className="absolute inset-[1.1rem] rounded-[1.2rem] border border-white/65 bg-white/14 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]" />
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/35 bg-white/12 blur-sm" />
              </>
            )}
          </div>

          <div
            className="bg-transparent px-5 pb-3 pt-0.5 text-center"
            data-quote-guide-direct-caption="true"
            data-quote-guide-instruction-rail="true"
            data-quote-guide-instruction-state={instructionKey}
          >
            {instructionContent ? (
              <div className="relative flex justify-center overflow-hidden">
                <p
                  key={`${activeStep.id}-${instructionKey}`}
                  className="quote-guide-caption-copy quote-guide-caption-copy--animate inline-flex items-center justify-center gap-2 text-center text-[1.04rem] font-semibold leading-5 text-ink sm:text-[1.1rem]"
                >
                  <span
                    className="inline-block h-2 w-8 rounded-full bg-brand align-middle shadow-[0_0_0_4px_rgba(50,159,91,0.1)]"
                    aria-hidden="true"
                  />
                  {instructionContent.text}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-t border-[#DCE6DA] bg-[#F8FAF7] px-3 py-2 sm:gap-4">
          <button
            type="button"
            onClick={onPrevious}
            disabled={!canGoPrevious}
            aria-label="Previous guide step"
            className={cn(
              'inline-flex h-10 w-10 items-center justify-center rounded-full border text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
              canGoPrevious
                ? 'border-[#D6E0D4] bg-white text-copy-muted hover:border-brand/30 hover:text-ink'
                : 'border-[#E2E8DF] bg-white/70 text-copy-soft/80'
            )}
          >
            <span aria-hidden="true">&larr;</span>
          </button>

          <div
            className="flex items-center justify-center px-2 text-center"
            data-quote-guide-progress-rail="true"
          >
            <div className="flex items-center gap-1.5 px-2 py-1">
              {QUOTE_GUIDE_STEPS.map((step, stepIndex) => (
                <span
                  key={step.id}
                  className={cn(
                    'rounded-full transition-all duration-200',
                    stepIndex === renderedStepIndex
                      ? 'h-3.5 w-9 bg-brand shadow-[0_10px_18px_-12px_rgba(50,159,91,0.95)]'
                      : stepIndex < renderedStepIndex
                        ? 'h-3.5 w-6 bg-brand/45'
                        : 'h-3.5 w-6 bg-[#C8D4C6]'
                  )}
                  aria-hidden="true"
                />
              ))}
              <span className="sr-only">
                Step {renderedStepIndex + 1} of {QUOTE_GUIDE_STEPS.length}
              </span>
            </div>
          </div>

          {isFinalStep ? (
            <button
              type="button"
              onClick={handleGuideDone}
              disabled={transitionLocked}
              aria-label="Finish guide"
              data-quote-guide-finish-button="true"
              className={cn(
                'inline-flex h-10 items-center justify-center rounded-full border px-4 text-[0.78rem] font-semibold uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                transitionLocked
                  ? 'border-[#CBE3D3] bg-[#CBE3D3] text-white/90'
                  : 'border-brand bg-brand text-white shadow-[0_16px_30px_-22px_rgba(50,159,91,0.65)] hover:border-brand hover:bg-brand-muted'
              )}
            >
              Done
            </button>
          ) : (
            <button
              type="button"
              onClick={onNext}
              disabled={!canGoNext}
              aria-label="Next guide step"
              className={cn(
                'inline-flex h-10 w-10 items-center justify-center rounded-full border text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                canGoNext
                  ? 'border-brand bg-brand text-white shadow-[0_16px_30px_-22px_rgba(50,159,91,0.65)] hover:border-brand hover:bg-brand-muted'
                  : 'border-[#E2E8DF] bg-white/70 text-copy-soft/80'
              )}
            >
              <span aria-hidden="true">&rarr;</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
