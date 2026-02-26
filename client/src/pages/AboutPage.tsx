import { Card } from '../components/ui/Card';
import { PlaceholderImage } from '../components/ui/PlaceholderImage';
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
      description="Placeholder story content for Autoscape's mission and values."
    />

    <div className="mt-10 grid gap-8 md:grid-cols-[1.2fr_0.8fr]">
      <Card className="bg-black/45">
        <h3 className="text-xl font-semibold text-white">Our Story</h3>
        <p className="mt-4 text-sm leading-relaxed text-white/72">
          Placeholder: Autoscape started as a pilot program to pair autonomous navigation with predictable lawn quality. The mission is to replace inconsistent manual scheduling with data-backed, repeatable maintenance.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-white/72">
          Placeholder: every route is designed around plant health, neighborhood sound standards, and a clean, premium visual finish.
        </p>
      </Card>
      <PlaceholderImage label="Placeholder: Team calibrating autonomous mower" heightClassName="h-full min-h-64" />
    </div>

    <div className="mt-14">
      <SectionTitle
        badge="Team"
        title="Engineers and landscape operators"
        description="Placeholder profiles for final production bios."
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
