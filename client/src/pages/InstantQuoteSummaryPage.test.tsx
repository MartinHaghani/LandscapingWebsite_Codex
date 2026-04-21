import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { InstantQuoteSummaryContent } from './InstantQuoteSummaryPage';

const renderSummaryContent = () =>
  renderToStaticMarkup(
    <InstantQuoteSummaryContent
      selectedAddress="123 Greenway Blvd, Vaughan, ON"
      previewCenter={[-79.52, 43.84]}
      previewPolygons={[
        {
          id: 'polygon-1',
          kind: 'service',
          ringPoints: [
            [-79.52, 43.84],
            [-79.521, 43.84],
            [-79.521, 43.841]
          ],
          rawStrokePoints: null
        }
      ]}
      areaValue="450 m2"
      perimeterValue="92 m"
      billingMode="seasonal"
      onBillingModeChange={() => {}}
      quoteTotal={74.25}
      seasonalPricing={{
        sessionsMin: 20,
        sessionsMax: 20,
        fullSeasonTotal: 1485,
        seasonalDiscountRate: 0.2,
        seasonalDiscountedTotal: 1188,
        seasonalSavingsTotal: 297,
        seasonalTotalMin: 1485,
        seasonalTotalMax: 1485
      }}
      statusMessage={null}
      onBack={() => {}}
      onContinue={() => {}}
      canContinue
      submitting={false}
    />
  );

describe('InstantQuoteSummaryContent', () => {
  it('renders the redesigned weekly-only review layout with radio plan cards', () => {
    const markup = renderSummaryContent();
    const previewIndex = markup.indexOf('data-quote-preview="true"');
    const areaIndex = markup.indexOf('Area:');
    const perimeterIndex = markup.indexOf('Perimeter:');
    const plansIndex = markup.indexOf('Choose how to pay');

    expect(markup).not.toContain('Instant Quote');
    expect(markup).toContain('Quote summary');
    expect(markup).toContain('Your lawn quote is ready');
    expect(markup).toContain('Choose how to pay');
    expect(markup).not.toContain('Choose your billing plan');
    expect(markup).not.toContain('Bi-weekly');
    expect(markup).toContain('20 visits this season');
    expect(markup).toContain('Weekly visits');
    expect(markup).toContain('May to September');
    expect(markup).not.toContain('May 1 to September 30');
    expect(markup).toContain('450 m2');
    expect(markup).toContain('92 m');
    expect(markup.match(/Area:/g) ?? []).toHaveLength(1);
    expect(markup.match(/Perimeter:/g) ?? []).toHaveLength(1);
    expect(markup.match(/Back to Map/g) ?? []).toHaveLength(1);
    expect(markup.indexOf('Back to Map')).toBeLessThan(markup.indexOf('Your lawn quote is ready'));
    expect(previewIndex).toBeGreaterThan(markup.indexOf('Season schedule'));
    expect(previewIndex).toBeLessThan(plansIndex);
    expect(areaIndex).toBeLessThan(plansIndex);
    expect(perimeterIndex).toBeLessThan(plansIndex);
    expect(markup.indexOf('Service address')).toBeGreaterThan(markup.indexOf('Your lawn quote is ready'));
    expect(markup.indexOf('Service address')).toBeLessThan(markup.indexOf('Season plan'));
    expect(markup).not.toContain('Mapped lawn area');
    expect(markup).not.toContain('Preview from your saved drawing');
    expect(previewIndex).toBeGreaterThan(-1);
    expect(markup).toContain('role="radiogroup"');
    expect(markup.match(/role="radio"/g) ?? []).toHaveLength(2);
    expect(markup).toContain('aria-checked="true"');
    expect(markup).toContain('aria-checked="false"');
    expect(markup).toContain('Per Season');
    expect(markup).toContain('Per Visit');
    expect(markup).not.toContain('Per Session');
    expect(markup).toContain('$1,188.00');
    expect(markup).toContain('$74.25');
    expect(markup).toContain('$1,485.00');
    expect(markup).toContain('Save $297.00');
    expect(markup).toContain('Recommended');
    expect(markup).toContain('Full refund up to 24h after your first visit');
    expect(markup).toContain('full season if paid per visit');
    expect(markup).toContain('Pay after each completed visit');
    expect(markup).toContain('Cancel anytime');
    expect(markup).not.toContain('Selected Plan');
    expect(markup).not.toContain('Select Plan');
    expect(markup).toContain('How the rate is calculated');
    expect(markup).toContain('Submit Quote');
    expect(markup).not.toContain(
      'Double-check the mapped property, pricing, and billing preferences before we save the draft and move to contact details.'
    );
    expect(markup).not.toContain('Status');
    expect(markup).not.toContain('Service polygons:');
    expect(markup).not.toContain('Obstacle polygons:');
    expect(markup).not.toContain('Active polygon:');
    expect(markup).not.toContain('Units');
    expect(markup).not.toContain('Regular price:');
    expect(markup).not.toContain('Step 3 of 3');
    expect(markup).not.toContain('first session');
    expect(markup).not.toContain('Estimated full season total:');
  });
});
