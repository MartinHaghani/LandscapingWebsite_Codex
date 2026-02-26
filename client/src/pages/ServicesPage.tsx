import { Card } from '../components/ui/Card';
import { PlaceholderImage } from '../components/ui/PlaceholderImage';
import { SectionTitle } from '../components/ui/SectionTitle';

const serviceCards = [
  {
    title: 'Autonomous Mowing',
    description:
      'Placeholder: robotic mowing sequences tuned for blade health, growth rate, and visual striping consistency.'
  },
  {
    title: 'Smart Edging',
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

    <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {serviceCards.map((service) => (
        <Card key={service.title}>
          <PlaceholderImage
            label={`Placeholder: ${service.title.toLowerCase()} visual`}
            heightClassName="h-44"
          />
          <h3 className="mt-5 text-xl font-semibold text-white">{service.title}</h3>
          <p className="mt-3 text-sm text-white/70">{service.description}</p>
        </Card>
      ))}
    </div>
  </div>
);
