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
  it('renders the active five-card illustrated lineup without Multi-Zone Scheduling', () => {
    const markup = renderServicesPage();

    expect(markup).toContain('Autonomous Mowing');
    expect(markup).toContain('Smart Edging');
    expect(markup).toContain('Cleanup &amp; Debris');
    expect(markup).toContain('Seasonal Maintenance');
    expect(markup).toContain('Performance Reporting');

    expect(markup).toContain('data-service-illustration="autonomousMowing"');
    expect(markup).toContain('data-service-illustration="smartEdging"');
    expect(markup).toContain('data-service-illustration="cleanupDebris"');
    expect(markup).toContain('data-service-illustration="seasonalMaintenance"');
    expect(markup).toContain('data-service-illustration="performanceReporting"');

    expect(markup).not.toContain('Multi-Zone Scheduling');
    expect(markup).not.toContain('<img');
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
