import { Link } from 'react-router-dom';
import { HomeLawnmowersSection } from '../components/home/HomeLawnmowersSection';
import { HomePricingComparisonSection } from '../components/home/HomePricingComparisonSection';
import { Card } from '../components/ui/Card';
import { SectionTitle } from '../components/ui/SectionTitle';
import { Button } from '../components/ui/Button';
import { HomeHeroLawnGraphic } from '../components/home/HomeHeroLawnGraphic';

const faqs = [
  {
    question: 'How often do autonomous cuts run?',
    answer:
      'Autoscape instant quotes use weekly service with 20 visits from May to September for per-visit and seasonal projections.'
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
    <section className="relative overflow-hidden border-b border-stroke bg-mesh md:h-[calc(100svh-73px)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col px-4 py-6 md:h-full md:px-8 md:py-3">
        <div className="grid gap-4 md:min-h-0 md:flex-1 md:grid-cols-2 md:items-center md:gap-6">
          <div className="fade-up flex items-center justify-center md:h-full">
            <div className="w-full max-w-[24rem]">
              <h1 className="font-display text-4xl font-bold leading-tight text-ink md:text-6xl">
                Autonomous Landscaping Service
              </h1>
              <p className="mt-6 max-w-xl text-base text-copy-muted md:text-lg">
                Percise Cuts, Lower Costs
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <div>
                  <Link to="/instant-quote">
                    <Button>Get Instant Quote</Button>
                  </Link>
                </div>
                <Link to="/contact">
                  <Button variant="secondary">Talk to the Team</Button>
                </Link>
              </div>
              <p className="mt-3 text-sm font-medium text-copy-soft">No sign-up required.</p>
            </div>
          </div>

          <div className="fade-up flex min-h-0 items-center justify-center md:h-full [animation-delay:120ms]">
            <HomeHeroLawnGraphic className="h-[360px] w-full md:h-full" />
          </div>
        </div>
      </div>
    </section>

    <HomePricingComparisonSection />
    <HomeLawnmowersSection />

    <section className="border-y border-stroke bg-surface">
      <div className="mx-auto w-full max-w-7xl px-4 py-20 md:px-8">
        <SectionTitle
          badge="Services"
          title="Maintenance designed for premium residential properties"
          description="Autonomous mowing is the foundation, with finishing work and seasonal tuning for consistent quality."
        />

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Card className="bg-surface">
            <h3 className="text-xl font-semibold text-ink">Autonomous Mowing</h3>
            <p className="mt-3 text-sm text-copy-muted">
              Repeatable route execution for uniform cut quality and reduced noise compared to
              conventional gas-powered schedules.
            </p>
          </Card>
          <Card className="bg-surface">
            <h3 className="text-xl font-semibold text-ink">Edge + Detail Finishing</h3>
            <p className="mt-3 text-sm text-copy-muted">
              Precision perimeter detailing maintains clean boundaries around driveways, beds, and
              walkways.
            </p>
          </Card>
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
          <Card key={faq.question} className="bg-surface">
            <h3 className="text-lg font-semibold text-ink">{faq.question}</h3>
            <p className="mt-2 text-sm text-copy-muted">{faq.answer}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-12 border-brand/40 bg-brand/10">
        <h3 className="text-2xl font-semibold text-ink">Ready to see your exact quote?</h3>
        <p className="mt-3 text-sm text-copy-muted">
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
