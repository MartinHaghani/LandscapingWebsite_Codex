import { Card } from '../components/ui/Card';
import { SectionTitle } from '../components/ui/SectionTitle';

const team = [
  { name: 'Avery Lin', role: 'Founder & Robotics Lead' },
  { name: 'Jordan Hale', role: 'Operations Director' },
  { name: 'Riley Brooks', role: 'Field Systems Engineer' }
];

export const AboutPage = () => (
  <div className="mx-auto w-full max-w-7xl px-4 py-16 md:px-8 md:py-20">
    <SectionTitle
      badge="About"
      title="Built to modernize residential landscaping"
      description="Autoscape combines autonomous operations and practical field expertise to deliver cleaner, more predictable lawn care."
    />

    <div className="mt-10 grid gap-8 md:grid-cols-[1.2fr_0.8fr]">
      <Card className="bg-black/45">
        <h3 className="text-xl font-semibold text-white">Our Story</h3>
        <p className="mt-4 text-sm leading-relaxed text-white/72">
          Autoscape began as a field pilot focused on one question: can residential lawn care be
          measured and delivered with the same consistency as a modern logistics system?
        </p>
        <p className="mt-4 text-sm leading-relaxed text-white/72">
          Today, our intake flow starts with service coverage, then uses geodesic-safe boundary
          mapping to generate deterministic quote data. Each request moves into an operations
          workflow designed for accountability and long-term quality.
        </p>
      </Card>

      <Card className="flex h-full min-h-64 flex-col justify-between border-brand/35 bg-brand/10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
            Operating Principles
          </p>
          <ul className="mt-4 list-disc space-y-3 pl-5 text-sm text-white/80">
            <li>Geometry correctness before pricing.</li>
            <li>Low-noise electric operations where possible.</li>
            <li>Transparent quote IDs and follow-through after submission.</li>
          </ul>
        </div>
        <p className="mt-6 text-xs text-white/60">
          Serving modern residential properties in the Greater Toronto Area.
        </p>
      </Card>
    </div>

    <div className="mt-14">
      <SectionTitle
        badge="Team"
        title="Engineers and landscape operators"
        description="A blended team of robotics, operations, and field-maintenance specialists."
      />

      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {team.map((member) => (
          <Card key={member.name} className="text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-brand/40 bg-brand/15 text-2xl font-semibold text-brand">
              {member.name
                .split(' ')
                .map((token) => token[0])
                .join('')}
            </div>
            <p className="mt-4 text-lg font-semibold text-white">{member.name}</p>
            <p className="text-sm text-white/65">{member.role}</p>
          </Card>
        ))}
      </div>
    </div>
  </div>
);
