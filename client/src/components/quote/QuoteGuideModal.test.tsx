import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QUOTE_GUIDE_DEMO_BACKGROUND_TOP } from '../../lib/quoteGuideDemo';
import { QuoteGuideModal } from './QuoteGuideModal';

const renderQuoteGuideModal = (activeStepIndex: number) =>
  renderToStaticMarkup(
    <QuoteGuideModal
      activeStepIndex={activeStepIndex}
      onClose={() => undefined}
      onDone={() => undefined}
      onPrevious={() => undefined}
      onNext={() => undefined}
    />
  );

describe('QuoteGuideModal', () => {
  it('renders the step 1 draw demo shell', () => {
    const markup = renderQuoteGuideModal(0);

    expect(markup).toContain('data-guide-draw-demo="true"');
    expect(markup).toContain('data-quote-guide-step-kind="draw-demo"');
    expect(markup).toContain('data-guide-house-background-svg="true"');
    expect(markup).toContain('data-guide-camera-layer="true"');
    expect(markup).toContain('data-guide-demo-stage="true"');
    expect(markup).toContain(`top:-${QUOTE_GUIDE_DEMO_BACKGROUND_TOP}px`);
    expect(markup).toContain('quote-guide-step-shell quote-guide-step-shell--animate relative flex min-h-[25.5rem] flex-1 overflow-hidden bg-[#F3F7F1] quote-guide-step-shell--phase-idle');
    expect(markup).toContain('data-quote-guide-step-transition-phase="idle"');
    expect(markup).toContain('data-quote-guide-media-unit="true"');
    expect(markup).toContain('quote-guide-media-unit--fade');
    expect(markup).toContain('data-quote-guide-direct-caption="true"');
    expect(markup).toContain('bg-transparent px-5 pb-3 pt-0.5 text-center');
    expect(markup).toContain('relative flex justify-center overflow-hidden');
    expect(markup).toContain(
      'inline-flex items-center justify-center gap-2 text-center text-[1.04rem] font-semibold leading-5 text-ink sm:text-[1.1rem]'
    );
    expect(markup).toContain('data-guide-step-scale-cap="1"');
    expect(markup).toContain('transform 1600ms');
    expect(markup).not.toContain('data-quote-guide-caption-card="true"');
    expect(markup).toContain('data-quote-guide-instruction-rail="true"');
    expect(markup).toContain('data-quote-guide-progress-rail="true"');
    expect(markup).toContain('data-quote-guide-modal-exit-phase="idle"');
    expect(markup).toContain('Draw loosely around your lawn.');
    expect(markup).toContain('Draw lawn');
    expect(markup).not.toContain('Meadow View');
    expect(markup.match(/data-guide-demo-toolbar-button="true"/g) ?? []).toHaveLength(7);
    expect(markup).toContain('w-[4.95rem]');
  });

  it('renders the step 2 multi-zone SVG lesson shell', () => {
    const markup = renderQuoteGuideModal(1);

    expect(markup).toContain('data-guide-multi-zone-demo="true"');
    expect(markup).toContain('data-quote-guide-step-kind="multi-zone-edit-demo"');
    expect(markup).toContain('data-guide-camera-layer="true"');
    expect(markup).toContain(`top:-${QUOTE_GUIDE_DEMO_BACKGROUND_TOP}px`);
    expect(markup).toContain('Draw each separate lawn area on its own.');
  });

  it('renders the step 3 SVG obstacle demo shell with a finish action', () => {
    const markup = renderQuoteGuideModal(2);

    expect(markup).toContain('data-guide-obstacle-demo="true"');
    expect(markup).toContain('data-quote-guide-step-kind="obstacle-draw-demo"');
    expect(markup).toContain('data-quote-guide-finish-button="true"');
    expect(markup).toContain('Finish guide');
    expect(markup).not.toContain('aria-label="Next guide step"');
    expect(markup).toContain('Use Draw obstacle for gardens, pools, and other no-mow areas.');
  });

  it('keeps the instruction caption outside the progress-pill rail', () => {
    const markup = renderQuoteGuideModal(1);
    const mediaUnitIndex = markup.indexOf('data-quote-guide-media-unit="true"');
    const stepShellIndex = markup.indexOf('data-quote-guide-step-kind="multi-zone-edit-demo"');
    const captionIndex = markup.indexOf('data-quote-guide-direct-caption="true"');
    const instructionIndex = markup.indexOf('Draw each separate lawn area on its own.');
    const progressIndex = markup.indexOf('data-quote-guide-progress-rail="true"');
    const captionSegment = markup.slice(captionIndex, captionIndex + 420);

    expect(mediaUnitIndex).toBeGreaterThan(-1);
    expect(stepShellIndex).toBeGreaterThan(mediaUnitIndex);
    expect(captionIndex).toBeGreaterThan(stepShellIndex);
    expect(instructionIndex).toBeGreaterThan(captionIndex);
    expect(progressIndex).toBeGreaterThan(instructionIndex);
    expect(captionSegment).not.toContain('border-t');
    expect(markup).toContain('bg-transparent px-5 pb-3 pt-0.5 text-center');
    expect(captionSegment).toContain('justify-center');
  });
});
