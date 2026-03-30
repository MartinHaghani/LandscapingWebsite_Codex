import { lazy, Suspense } from 'react';
import {
  ServiceIllustration,
  type ServiceIllustrationKey
} from '../components/service/ServiceIllustrations';
import { Card } from '../components/ui/Card';
import { SectionTitle } from '../components/ui/SectionTitle';

const LazyServiceAreaSection = lazy(() =>
  import('../components/service/ServiceAreaSection').then((module) => ({
    default: module.ServiceAreaSection
  }))
);

type ServiceCard = {
  title: string;
  illustration: ServiceIllustrationKey;
  decorative: boolean;
  description: string;
};

const serviceCards: ServiceCard[] = [
  {
    title: 'Autonomous Mowing',
    illustration: 'autonomousMowing',
    decorative: true,
    description:
      'Route-planned recurring mowing designed for consistency, lower noise, and predictable property presentation.'
  },
  {
    title: 'Smart Edging',
    illustration: 'smartEdging',
    decorative: true,
    description:
      'Perimeter detailing around paths, beds, and driveways to preserve clean boundaries and finished curb appeal.'
  },
  {
    title: 'Cleanup & Debris',
    illustration: 'cleanupDebris',
    decorative: true,
    description:
      'Light debris and clipping management built into each visit to maintain a neat and client-ready finish.'
  },
  {
    title: 'Seasonal Maintenance',
    illustration: 'seasonalMaintenance',
    decorative: true,
    description:
      'Season-aware mowing height and route adjustments tuned for spring acceleration and mid-summer stress periods.'
  },
  {
    title: 'Performance Reporting',
    illustration: 'performanceReporting',
    decorative: true,
    description:
      'Quote metadata and operational records make each request traceable from initial draft through final submission.'
  }
];

export const ServicesPage = () => (
  <div className="mx-auto w-full max-w-7xl px-4 py-16 md:px-8 md:py-20">
    <SectionTitle
      badge="Services"
      title="Autonomous care services for high-standard properties"
      description="Coverage-first intake and deterministic quote logic keep planning transparent before service begins."
    />

    <Suspense
      fallback={
        <Card className="mt-14 bg-surface">
          <p className="text-sm text-copy-muted">Loading service area...</p>
        </Card>
      }
    >
      <LazyServiceAreaSection />
    </Suspense>

    <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {serviceCards.map((service) => (
        <Card key={service.title}>
          <div className="aspect-[8/5] w-full overflow-hidden rounded-2xl border border-stroke bg-[#f2ede2]">
            <ServiceIllustration
              illustration={service.illustration}
              decorative={service.decorative}
              className="h-full w-full"
            />
          </div>
          <h3 className="mt-5 text-xl font-semibold text-ink">{service.title}</h3>
          <p className="mt-3 text-sm text-copy-muted">{service.description}</p>
        </Card>
      ))}
    </div>
  </div>
);
