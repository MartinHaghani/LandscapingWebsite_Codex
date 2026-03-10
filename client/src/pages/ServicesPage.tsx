import { lazy, Suspense } from 'react';
import { Card } from '../components/ui/Card';
import { PlaceholderImage } from '../components/ui/PlaceholderImage';
import { SectionTitle } from '../components/ui/SectionTitle';

const LazyServiceAreaSection = lazy(() =>
  import('../components/service/ServiceAreaSection').then((module) => ({
    default: module.ServiceAreaSection
  }))
);

const serviceCards = [
  {
    title: 'Autonomous Mowing',
    description:
      'Placeholder: robotic mowing sequences tuned for blade health, growth rate, and visual striping consistency.'
  },
  {
    title: 'Smart Edging',
    imageSrc: '/images/services/smart-edging.jpg',
    description:
      'Placeholder: perimeter trim passes executed after autonomous routes for sharp, clean property lines.'
  },
  {
    title: 'Cleanup & Debris',
    description:
      'Placeholder: light debris management and clipping control integrated into recurring service cycles.'
  },
  {
    title: 'Seasonal Maintenance',
    imageSrc: '/images/services/seasonal-maintenance.jpg',
    description:
      'Placeholder: adaptive height schedules and route revisions for spring acceleration and summer heat stress.'
  },
  {
    title: 'Multi-Zone Scheduling',
    description:
      'Placeholder: independent logic for front yard, backyard, and specialty landscape sections.'
  },
  {
    title: 'Performance Reporting',
    description:
      'Placeholder: dashboard snapshots for route completion, battery cycles, and maintenance checkpoints.'
  }
];

export const ServicesPage = () => (
  <div className="mx-auto w-full max-w-7xl px-4 py-16 md:px-8 md:py-20">
    <SectionTitle
      badge="Services"
      title="Autonomous care services for high-standard properties"
      description="Placeholder service detail copy that matches Autoscape's premium and technical voice."
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
            <PlaceholderImage
              label={`Placeholder: ${service.title.toLowerCase()} visual`}
              heightClassName="h-44"
            />
          )}
          <h3 className="mt-5 text-xl font-semibold text-white">{service.title}</h3>
          <p className="mt-3 text-sm text-white/70">{service.description}</p>
        </Card>
      ))}
    </div>
  </div>
);
