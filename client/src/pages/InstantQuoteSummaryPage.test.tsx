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
      serviceFrequency="weekly"
      onServiceFrequencyChange={() => {}}
      billingMode="seasonal"
      onBillingModeChange={() => {}}
      quoteTotal={74.25}
      seasonalPricing={{
        sessionsMin: 26,
        sessionsMax: 26,
        fullSeasonTotal: 1930.5,
        seasonalDiscountRate: 0.2,
        seasonalDiscountedTotal: 1544.4,
        seasonalSavingsTotal: 386.1,
        seasonalTotalMin: 1930.5,
        seasonalTotalMax: 1930.5
      }}
      statusMessage={null}
      onBack={() => {}}
      onContinue={() => {}}
      canContinue
      submitting={false}
    />
  );

describe('InstantQuoteSummaryContent', () => {
  it('renders the unified review layout with one back action and plan selection CTA', () => {
    const markup = renderSummaryContent();

    expect(markup).toContain('Quote Summary');
    expect(markup).toContain('Choose your billing plan');
    expect(markup).toContain('26 visits this season');
    expect(markup).toContain('450 m2');
    expect(markup).toContain('92 m');
    expect(markup).toContain('data-quote-preview="true"');
    expect(markup).toContain('Per Season');
    expect(markup).toContain('Per Session');
    expect(markup).toContain('You save $386.10 this season');
    expect(markup).toContain('Full refund up to 24h after your first session');
    expect(markup).toContain('Total $1930.50 this season');
    expect(markup).toContain('Pay after each completed visit');
    expect(markup).toContain('Cancel anytime');
    expect(markup).toContain('Selected Plan');
    expect(markup).toContain('Select Plan');
    expect(markup).toContain('How the rate is calculated');
    expect(markup).toContain('Submit Quote');
    expect(markup.match(/Back to Map/g) ?? []).toHaveLength(1);
    expect(markup).not.toContain(
      'Double-check the mapped property, pricing, and billing preferences before we save the draft and move to contact details.'
    );
    expect(markup).not.toContain('Status');
    expect(markup).not.toContain('Service polygons:');
    expect(markup).not.toContain('Obstacle polygons:');
    expect(markup).not.toContain('Active polygon:');
    expect(markup).not.toContain('Units');
    expect(markup).not.toContain('Regular price:');
    expect(markup).not.toContain('Charged once after confirmation with refund protection up to 24h after your first session.');
    expect(markup).not.toContain('Estimated full season total:');
  });
});
