import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it } from 'vitest';
import { ServiceAreaMap } from '../components/service/ServiceAreaMap';
import { ServicesPage } from './ServicesPage';

const renderServicesPage = () =>
  renderToStaticMarkup(
    <StaticRouter location="/services">
      <ServicesPage />
    </StaticRouter>
  );

describe('ServicesPage service gallery', () => {
  it('renders the services included image lineup before the service area', () => {
    const markup = renderServicesPage();
    const servicesIncludedIndex = markup.indexOf('Services included');
    const serviceAreaIndex = markup.indexOf('Service Area');

    expect(servicesIncludedIndex).toBeGreaterThanOrEqual(0);
    expect(serviceAreaIndex).toBeGreaterThanOrEqual(0);
    expect(servicesIncludedIndex).toBeLessThan(serviceAreaIndex);
    expect(markup).toContain('Mowing');
    expect(markup).toContain('Edging');
    expect(markup).toContain('Cleanup &amp; Debris');
    expect(markup).toContain('Performance Reporting');
    expect(markup).not.toContain('Seasonal Maintenance');
    expect(markup).not.toContain('Autonomous care services for high-standard properties');

    expect(markup.match(/<img/g) ?? []).toHaveLength(4);
    expect(markup).toContain('src="/images/services/autonomous-mowing.png"');
    expect(markup).toContain('src="/images/services/smart-edging.png"');
    expect(markup).toContain('src="/images/services/cleanup-debris.png"');
    expect(markup).toContain('src="/images/services/performance-reporting.png"');

    expect(markup).not.toContain('Multi-Zone Scheduling');
    expect(markup).not.toContain('data-service-illustration');
  });
});

describe('ServiceAreaMap mobile sizing', () => {
  it('uses a shorter mobile-first map height before expanding at larger breakpoints', () => {
    const markup = renderToStaticMarkup(
      <ServiceAreaMap token="test-token" serviceArea={null} showOverlay />
    );

    expect(markup).toContain('h-[300px]');
    expect(markup).toContain('sm:h-[340px]');
    expect(markup).toContain('md:h-[360px]');
    expect(markup).not.toContain('h-[440px]');
  });
});
