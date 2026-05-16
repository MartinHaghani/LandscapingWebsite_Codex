import { ServiceAreaSection } from '../components/service/ServiceAreaSection';
import { Card } from '../components/ui/Card';

type ServiceCard = {
  title: string;
  imageSrc: string;
  imageAlt: string;
  description: string;
};

const serviceCards: ServiceCard[] = [
  {
    title: 'Autonomous Mowing',
    imageSrc: '/images/services/autonomous-mowing.png',
    imageAlt: 'Autonomous mower cutting a residential lawn from above.',
    description:
      'Route-planned recurring mowing designed for consistency, lower noise, and predictable property presentation.'
  },
  {
    title: 'Smart Edging',
    imageSrc: '/images/services/smart-edging.png',
    imageAlt: 'Clean lawn edge along a sidewalk.',
    description:
      'Perimeter detailing around paths, beds, and driveways to preserve clean boundaries and finished curb appeal.'
  },
  {
    title: 'Cleanup & Debris',
    imageSrc: '/images/services/cleanup-debris.png',
    imageAlt: 'Residential lawn with leaves and small debris before cleanup.',
    description:
      'Light debris and clipping management built into each visit to maintain a neat and client-ready finish.'
  },
  {
    title: 'Performance Reporting',
    imageSrc: '/images/services/performance-reporting.png',
    imageAlt: 'Phone showing Autoscape mowing completion photos.',
    description:
      'Photo-backed service updates after each visit make completed work easy to review and keep property care traceable.'
  }
];

export const ServicesPage = () => (
  <div className="mx-auto w-full max-w-7xl px-4 py-16 md:px-8 md:py-20">
    <section aria-labelledby="services-included-title">
      <h1
        id="services-included-title"
        className="font-display text-3xl font-bold tracking-tight text-ink md:text-5xl"
      >
        Services included
      </h1>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {serviceCards.map((service) => (
          <Card key={service.title}>
            <div className="aspect-[8/5] w-full overflow-hidden rounded-xl border border-stroke bg-surface-muted">
              <img
                src={service.imageSrc}
                alt={service.imageAlt}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-ink">{service.title}</h2>
            <p className="mt-3 text-sm text-copy-muted">{service.description}</p>
          </Card>
        ))}
      </div>
    </section>

    <ServiceAreaSection />
  </div>
);
