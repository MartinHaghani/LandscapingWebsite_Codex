import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { PlaceholderImage } from '../components/ui/PlaceholderImage';
import { SectionTitle } from '../components/ui/SectionTitle';
import { Button } from '../components/ui/Button';

const steps = [
  {
    title: 'Scan & Model',
    body: 'Placeholder: our routing engine maps your lawn dimensions and builds a repeatable autonomous coverage path.'
  },
  {
    title: 'Deploy Quiet Robotics',
    body: 'Placeholder: electric autonomous mowers execute consistent, low-noise cuts on your schedule.'
  },
  {
    title: 'Precision Finishing',
    body: 'Placeholder: edge cleanup and detail trimming happen after each run for a polished finish.'
  },
  {
    title: 'Seasonal Optimization',
    body: 'Placeholder: growth-rate tuning and route adjustments keep quality high all year.'
  }
];

const services = [
  'Autonomous mowing',
  'Smart edge detailing',
  'Debris cleanup',
  'Seasonal maintenance'
];

const faqs = [
  {
    question: 'How often do autonomous cuts run?',
    answer: 'Placeholder: frequency is tuned per growth profile, weather trends, and preferred lawn height.'
  },
  {
    question: 'What if my yard has multiple zones?',
    answer: 'Placeholder: zoning is mapped in the setup process and each segment can run on independent schedules.'
  },
  {
    question: 'Is setup disruptive?',
    answer: 'Placeholder: installation is fast, quiet, and designed to preserve existing landscaping aesthetics.'
  }
];

export const HomePage = () => (
  <div>
    <section className="relative overflow-hidden border-b border-white/10 bg-mesh">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-20 md:grid-cols-[1.1fr_0.9fr] md:px-8 md:py-28">
        <div className="fade-up">
          <p className="text-xs uppercase tracking-[0.2em] text-brand">Autonomous Lawn Systems</p>
          <h1 className="mt-5 font-display text-4xl font-bold leading-tight text-white md:text-6xl">
            Autonomous lawn care, perfected.
          </h1>
          <p className="mt-6 max-w-xl text-base text-white/72 md:text-lg">
            Placeholder copy: Autoscape pairs robotics and precision route intelligence to deliver consistent, premium landscaping outcomes.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link to="/instant-quote">
              <Button>Get Instant Quote</Button>
            </Link>
            <Link to="/contact">
              <Button variant="secondary">Contact</Button>
            </Link>
          </div>
        </div>

        <div className="fade-up [animation-delay:120ms]">
          <PlaceholderImage label="Placeholder: Autonomous mower fleet in structured stripes" heightClassName="h-[340px]" />
        </div>
      </div>
    </section>

    <section className="mx-auto w-full max-w-7xl px-4 py-20 md:px-8">
      <SectionTitle
        badge="How It Works"
        title="From address to optimized route in minutes"
        description="Placeholder process summary for an easy onboarding flow."
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
          title="Smart maintenance services built around autonomous mowing"
          description="Placeholder copy for premium service blend."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {services.map((service) => (
            <Card key={service} className="flex items-center justify-between bg-white/[0.03]">
              <p className="text-lg font-medium text-white">{service}</p>
              <span className="rounded-full border border-brand/50 bg-brand/10 px-3 py-1 text-xs text-brand">Included</span>
            </Card>
          ))}
        </div>
      </div>
    </section>

    <section className="mx-auto w-full max-w-7xl px-4 py-20 md:px-8">
      <SectionTitle
        badge="Why Autoscape"
        title="Tech-forward, quiet, and relentlessly consistent"
        description="Placeholder value props designed for a premium brand tone."
      />
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        <Card>
          <PlaceholderImage label="Placeholder: Smart diagnostics dashboard" heightClassName="h-36" />
          <h3 className="mt-4 text-lg font-semibold text-white">Predictable Results</h3>
          <p className="mt-2 text-sm text-white/70">
            Placeholder: route consistency removes cut variance and maintains a uniform finish.
          </p>
        </Card>
        <Card>
          <PlaceholderImage label="Placeholder: Quiet electric platform" heightClassName="h-36" />
          <h3 className="mt-4 text-lg font-semibold text-white">Quiet Electric Operation</h3>
          <p className="mt-2 text-sm text-white/70">
            Placeholder: low-noise equipment supports early-morning or evening schedules with minimal disruption.
          </p>
        </Card>
        <Card>
          <PlaceholderImage label="Placeholder: Precision edge pass" heightClassName="h-36" />
          <h3 className="mt-4 text-lg font-semibold text-white">Detail Control</h3>
          <p className="mt-2 text-sm text-white/70">
            Placeholder: recurring edge cleanup and trim passes keep perimeter lines clean.
          </p>
        </Card>
      </div>
    </section>

    <section className="border-y border-white/10 bg-black/60">
      <div className="mx-auto w-full max-w-7xl px-4 py-20 md:px-8">
        <SectionTitle
          badge="Testimonials"
          title="What early adopters are saying"
          description="Placeholder customer statements for visual structure."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {['Northside Residence', 'Crestline HOA', 'Modern Commerce Park'].map((name) => (
            <Card key={name} className="bg-white/[0.04]">
              <p className="text-sm text-white/75">
                “Placeholder feedback: Autoscape delivers immaculate cuts with a schedule we never have to micromanage.”
              </p>
              <p className="mt-4 text-sm font-semibold text-brand">{name}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>

    <section className="mx-auto w-full max-w-7xl px-4 py-20 md:px-8">
      <SectionTitle
        badge="FAQ"
        title="Common questions"
        description="Placeholder FAQs while final operations copy is prepared."
      />
      <div className="mt-10 space-y-4">
        {faqs.map((faq) => (
          <Card key={faq.question} className="bg-black/45">
            <h3 className="text-lg font-semibold text-white">{faq.question}</h3>
            <p className="mt-2 text-sm text-white/70">{faq.answer}</p>
          </Card>
        ))}
      </div>
    </section>
  </div>
);
