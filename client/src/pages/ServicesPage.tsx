import { lazy, Suspense } from 'react';
import { Card } from '../components/ui/Card';
import { SectionTitle } from '../components/ui/SectionTitle';

const LazyServiceAreaSection = lazy(() =>
  import('../components/service/ServiceAreaSection').then((module) => ({
    default: module.ServiceAreaSection
  }))
);

const serviceCards = [
  {
    title: 'Autonomous Mowing',
    imageSrc: '/images/home/autonomous-mower-fleet.png',
    description:
      'Route-planned recurring mowing designed for consistency, lower noise, and predictable property presentation.'
  },
  {
    title: 'Smart Edging',
    imageSrc: '/images/services/smart-edging.jpg',
    description:
      'Perimeter detailing around paths, beds, and driveways to preserve clean boundaries and finished curb appeal.'
  },
  {
    title: 'Cleanup & Debris',
    description:
      'Light debris and clipping management built into each visit to maintain a neat and client-ready finish.'
  },
  {
    title: 'Seasonal Maintenance',
    imageSrc: '/images/services/seasonal-maintenance.jpg',
    description:
      'Season-aware mowing height and route adjustments tuned for spring acceleration and mid-summer stress periods.'
  },
  {
    title: 'Multi-Zone Scheduling',
    description:
      'Independent service polygon mapping for front yards, backyards, side lots, and specialty landscaped sections.'
  },
  {
    title: 'Performance Reporting',
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
        <Card className="mt-14 bg-black/55">
          <p className="text-sm text-white/70">Loading service area...</p>
        </Card>
      }
    >
      <LazyServiceAreaSection />
    </Suspense>

    <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {serviceCards.map((service) => (
        <Card key={service.title}>
          {service.imageSrc ? (
            <img
              src={service.imageSrc}
              alt={service.title}
              className="h-44 w-full rounded-2xl border border-white/20 object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-44 items-center justify-center rounded-2xl border border-white/20 bg-black/45">
              <span className="text-sm font-semibold uppercase tracking-[0.12em] text-brand">
                {service.title}
              </span>
            </div>
          )}
          <h3 className="mt-5 text-xl font-semibold text-white">{service.title}</h3>
          <p className="mt-3 text-sm text-white/70">{service.description}</p>
        </Card>
      ))}
    </div>
  </div>
);
