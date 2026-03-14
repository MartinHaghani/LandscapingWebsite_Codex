import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { SectionTitle } from '../components/ui/SectionTitle';
import { Button } from '../components/ui/Button';
import { StatsBar } from '../components/ui/StatsBar';

const steps = [
  {
    title: 'Check Coverage',
    body: 'Enter your address and instantly confirm service eligibility before you spend time drawing your property.'
  },
  {
    title: 'Map Property Boundaries',
    body: 'Draw service polygons and obstacle zones directly on the map with geodesic-safe measurement.'
  },
  {
    title: 'Get Deterministic Pricing',
    body: 'Receive a per-session estimate and seasonal range based on verified area, perimeter, and cadence.'
  },
  {
    title: 'Finalize in One Step',
    body: 'Submit contact details to lock your quote ID and route it to our operations team for final review.'
  }
];

const stats = [
  { label: 'Quote Time', value: '< 3 minutes' },
  { label: 'Geometry Validation', value: 'Server re-measured' },
  { label: 'Season Planning', value: 'Weekly or bi-weekly' }
];

const faqs = [
  {
    question: 'How often do autonomous cuts run?',
    answer:
      'You can choose weekly or bi-weekly service when generating your quote. We use that cadence to provide per-session and seasonal projections.'
  },
  {
    question: 'What if my yard has multiple zones?',
    answer:
      'Use multiple service polygons for disconnected lawn sections, and add obstacle polygons for pools, planters, and hardscape areas.'
  },
  {
    question: 'Is setup disruptive?',
    answer:
      'No. Service is planned for low-noise windows, and perimeter finishes are handled with precision detailing to keep your property presentation clean.'
  }
];

export const HomePage = () => (
  <div>
    <section className="relative overflow-hidden border-b border-white/10 bg-mesh">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-20 md:grid-cols-[1.1fr_0.9fr] md:px-8 md:py-28">
        <div className="fade-up">
          <h1 className="mt-5 font-display text-4xl font-bold leading-tight text-white md:text-6xl">
            Precision Lawn Care, Powered by Autonomous Operations
          </h1>
          <p className="mt-6 max-w-xl text-base text-white/72 md:text-lg">
            Autoscape combines on-map measurement, deterministic quote logic, and quiet electric
            equipment to deliver consistent curb appeal.
          </p>
          <div className="mt-8 flex flex-wrap items-start gap-4">
            <div className="flex flex-col items-start">
              <Link to="/instant-quote">
                <Button>Get Instant Quote</Button>
              </Link>
              <p className="mt-2 text-xs text-white/62">
                No sign-up required. Quote ID generated instantly.
              </p>
            </div>
            <Link to="/contact">
              <Button variant="secondary">Talk to the Team</Button>
            </Link>
          </div>
        </div>

        <div className="fade-up [animation-delay:120ms]">
          <img
            src="/images/home/autonomous-mower-fleet.png"
            alt="Autonomous mower fleet in structured stripes"
            className="h-[340px] w-full rounded-2xl border border-white/20 object-cover"
            loading="lazy"
          />
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 pb-12 md:px-8 md:pb-16">
        <StatsBar items={stats} />
      </div>
    </section>

    <section className="mx-auto w-full max-w-7xl px-4 py-20 md:px-8">
      <SectionTitle
        badge="How It Works"
        title="From address to quote in minutes"
        description="Built for clarity: check coverage, map your property, and submit a complete request with no back-and-forth."
      />
      <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => (
          <Card key={step.title} className="bg-black/45">
            <p className="text-sm font-semibold text-brand">0{index + 1}</p>
            <h3 className="mt-4 text-xl font-semibold text-white">{step.title}</h3>
            <p className="mt-3 text-sm text-white/70">{step.body}</p>
          </Card>
        ))}
      </div>
    </section>

    <section className="border-y border-white/10 bg-black/60">
      <div className="mx-auto w-full max-w-7xl px-4 py-20 md:px-8">
        <SectionTitle
          badge="Services"
          title="Maintenance designed for premium residential properties"
          description="Autonomous mowing is the foundation, with finishing work and seasonal tuning for consistent quality."
        />

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Card className="bg-black/45">
            <h3 className="text-xl font-semibold text-white">Autonomous Mowing</h3>
            <p className="mt-3 text-sm text-white/72">
              Repeatable route execution for uniform cut quality and reduced noise compared to
              conventional gas-powered schedules.
            </p>
          </Card>
          <Card className="bg-black/45">
            <h3 className="text-xl font-semibold text-white">Edge + Detail Finishing</h3>
            <p className="mt-3 text-sm text-white/72">
              Precision perimeter detailing maintains clean boundaries around driveways, beds, and
              walkways.
            </p>
          </Card>
        </div>
      </div>
    </section>

    <section className="mx-auto w-full max-w-7xl px-4 py-20 md:px-8">
      <SectionTitle
        badge="Why Autoscape"
        title="Reliable operations, transparent pricing"
        description="Every quote and service run follows a clear system so homeowners know exactly what to expect."
      />
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        <Card>
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-brand/40 bg-brand/15 text-xl font-semibold text-brand">
            01
          </div>
          <h3 className="mt-4 text-lg font-semibold text-white">Deterministic Quotes</h3>
          <p className="mt-2 text-sm text-white/70">
            Geometry and pricing are validated server-side to keep quote outcomes consistent and
            auditable.
          </p>
        </Card>
        <Card>
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-brand/40 bg-brand/15 text-xl font-semibold text-brand">
            02
          </div>
          <h3 className="mt-4 text-lg font-semibold text-white">Coverage-First Workflow</h3>
          <p className="mt-2 text-sm text-white/70">
            Serviceability is checked early, so customers outside coverage get immediate guidance
            and expansion options.
          </p>
        </Card>
        <Card>
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-brand/40 bg-brand/15 text-xl font-semibold text-brand">
            03
          </div>
          <h3 className="mt-4 text-lg font-semibold text-white">Operational Follow-Through</h3>
          <p className="mt-2 text-sm text-white/70">
            Quote IDs, contact finalization, and admin workflows keep every request traceable from
            intake to review.
          </p>
        </Card>
      </div>
    </section>

    <section className="border-y border-white/10 bg-black/60">
      <div className="mx-auto w-full max-w-7xl px-4 py-20 md:px-8">
        <SectionTitle
          badge="Testimonials"
          title="What homeowners value most"
          description="Feedback from pilot customers using autonomous recurring care."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            {
              name: 'Northside Residence',
              quote:
                'The lawn stays consistent week after week, and the instant quote process was far clearer than traditional estimates.'
            },
            {
              name: 'Crestline HOA',
              quote:
                'We needed predictable scheduling and quiet operation. Autoscape delivered both with strong communication.'
            },
            {
              name: 'Modern Commerce Park',
              quote:
                'Mapping obstacle zones directly in the quote tool reduced setup back-and-forth and improved first-pass quality.'
            }
          ].map((item) => (
            <Card key={item.name} className="bg-white/[0.04]">
              <p className="text-sm text-white/75">"{item.quote}"</p>
              <p className="mt-4 text-sm font-semibold text-brand">{item.name}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>

    <section className="mx-auto w-full max-w-7xl px-4 py-20 md:px-8">
      <SectionTitle
        badge="FAQ"
        title="Common questions"
        description="Answers to the questions most customers ask before starting instant quote."
      />
      <div className="mt-10 space-y-4">
        {faqs.map((faq) => (
          <Card key={faq.question} className="bg-black/45">
            <h3 className="text-lg font-semibold text-white">{faq.question}</h3>
            <p className="mt-2 text-sm text-white/70">{faq.answer}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-12 border-brand/40 bg-brand/10">
        <h3 className="text-2xl font-semibold text-white">Ready to see your exact quote?</h3>
        <p className="mt-3 text-sm text-white/75">
          Start with your address, map your property boundaries, and receive a deterministic
          estimate in minutes.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/instant-quote">
            <Button>Start Instant Quote</Button>
          </Link>
          <Link to="/services">
            <Button variant="secondary">View Services</Button>
          </Link>
        </div>
      </Card>
    </section>
  </div>
);
