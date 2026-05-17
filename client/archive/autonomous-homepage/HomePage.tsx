import { Link } from 'react-router-dom';
import { HomeLawnmowersSection } from '../components/home/HomeLawnmowersSection';
import { HomeMowerActionSection } from '../components/home/HomeMowerActionSection';
import { HomePricingComparisonSection } from '../components/home/HomePricingComparisonSection';
import { Card } from '../components/ui/Card';
import { SectionTitle } from '../components/ui/SectionTitle';
import { Button } from '../components/ui/Button';
import { HomeHeroLawnGraphic } from '../components/home/HomeHeroLawnGraphic';

const faqs = [
  {
    question: 'How often do autonomous cuts run?',
    answer: (
      <>
        Services run <strong className="font-semibold text-ink">weekly</strong> with around{' '}
        <strong className="font-semibold text-ink">20 visits</strong> from the start of May to the
        end of September.
      </>
    )
  },
  {
    question: 'What areas do you serve?',
    answer: (
      <>
        We currently serve around the <strong className="font-semibold text-ink">Vaughan area</strong>.
        Our service area is shown in the <strong className="font-semibold text-ink">services tab</strong>.
        If you are not sure whether you are in range, check with our{' '}
        <strong className="font-semibold text-ink">instant quote tool</strong>.
      </>
    )
  },
  {
    question: 'Do I need to be home for service?',
    answer: (
      <>
        <strong className="font-semibold text-ink">In most cases, no.</strong> Service is designed
        to be low-touch, but we require <strong className="font-semibold text-ink">access to the entire lawn</strong>.
        If we ever need access or need to schedule on-site work, we will let you know{' '}
        <strong className="font-semibold text-ink">in advance</strong>.
      </>
    )
  },
  {
    question: 'Is autonomous lawn care safe for kids and pets?',
    answer: (
      <>
        <strong className="font-semibold text-ink">Safety matters.</strong> As with any lawn
        equipment, <strong className="font-semibold text-ink">normal caution</strong> is important
        during active operation. We will review the right setup and{' '}
        <strong className="font-semibold text-ink">best practices</strong> for your property so you
        feel confident using the system around your home.
      </>
    )
  },
  {
    question: 'What happens in rain or bad weather?',
    answer: (
      <>
        <strong className="font-semibold text-ink">Weather can affect mowing conditions and timing.</strong>{' '}
        When needed, mowing is <strong className="font-semibold text-ink">adjusted</strong> so your
        lawn stays on track.
      </>
    )
  },
  {
    question: 'How much does it cost?',
    answer: (
      <>
        <strong className="font-semibold text-ink">Pricing depends</strong> on your lawn size,
        layout, complexity, and the level of service you need. We will provide a{' '}
        <strong className="font-semibold text-ink">clear quote</strong> after learning more about
        your property and goals.
      </>
    )
  }
];

export const HomePage = () => (
  <div>
    <section className="relative overflow-hidden border-b border-stroke bg-mesh md:h-[calc(100svh-73px)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col px-4 py-8 md:h-full md:px-8 md:py-3">
        <div className="grid gap-6 md:min-h-0 md:flex-1 md:grid-cols-2 md:items-center md:gap-6">
          <div className="fade-up flex items-center justify-center md:h-full">
            <div className="w-full max-w-[24rem]">
              <h1 className="font-display text-4xl font-bold leading-tight text-ink md:text-6xl">
                Autonomous Landscaping Service
              </h1>
              <p className="mt-6 max-w-xl text-base text-copy-muted md:text-lg">
                Precise Cuts, Lower Costs
              </p>
              <div className="mt-7 flex flex-col gap-3 min-[375px]:flex-row min-[375px]:flex-wrap min-[375px]:items-center">
                <div className="w-full min-[375px]:w-auto">
                  <Link to="/instant-quote">
                    <Button className="w-full min-[375px]:w-auto">Get Instant Quote</Button>
                  </Link>
                </div>
                <Link to="/contact" className="w-full min-[375px]:w-auto">
                  <Button variant="secondary" className="w-full min-[375px]:w-auto">
                    Talk to the Team
                  </Button>
                </Link>
              </div>
              <p className="mt-3 text-sm font-medium text-copy-soft">No sign-up required.</p>
            </div>
          </div>

          <div className="fade-up flex min-h-0 items-center justify-center md:h-full [animation-delay:120ms]">
            <HomeHeroLawnGraphic className="h-[300px] w-full sm:h-[340px] md:h-full md:-translate-y-8 lg:-translate-y-10" />
          </div>
        </div>
      </div>
    </section>

    <HomePricingComparisonSection />
    <HomeMowerActionSection />
    <HomeLawnmowersSection />

    <section className="border-b border-stroke bg-[linear-gradient(180deg,rgba(247,244,238,0.76),rgba(255,255,255,0.96))]">
      <div className="mx-auto w-full max-w-7xl px-4 py-20 md:px-8">
        <SectionTitle
          badge="Services"
          title="Maintenance designed for premium residential properties"
          description="Autonomous mowing is the foundation, with finishing work and seasonal tuning for consistent quality."
        />

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <Card className="rounded-lg bg-white/85 shadow-[0_18px_44px_-40px_rgba(16,23,19,0.3)]">
            <h3 className="text-xl font-semibold text-ink">Autonomous Mowing</h3>
            <p className="mt-3 text-sm text-copy-muted">
              Repeatable route execution for uniform cut quality and reduced noise compared to
              conventional gas-powered schedules.
            </p>
          </Card>
          <Card className="rounded-lg bg-white/85 shadow-[0_18px_44px_-40px_rgba(16,23,19,0.3)]">
            <h3 className="text-xl font-semibold text-ink">Edging</h3>
            <p className="mt-3 text-sm text-copy-muted">
              Precision perimeter detailing maintains clean boundaries around driveways, beds, and
              walkways.
            </p>
          </Card>
          <Card className="rounded-lg bg-white/85 shadow-[0_18px_44px_-40px_rgba(16,23,19,0.3)]">
            <h3 className="text-xl font-semibold text-ink">Cleanup & Debris</h3>
            <p className="mt-3 text-sm text-copy-muted">
              Light debris and clipping management keeps each visit neat, polished, and ready for
              everyday use.
            </p>
          </Card>
        </div>
      </div>
    </section>

    <section className="border-b border-stroke bg-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-20 md:px-8">
        <SectionTitle
          badge="FAQ"
          title="Common questions"
          description="Answers to the questions most customers ask before starting instant quote."
        />
        <div className="mt-10 divide-y divide-stroke/80 border-y border-stroke/80">
          {faqs.map((faq) => (
            <div key={faq.question} className="py-5">
              <h3 className="text-lg font-semibold text-ink">{faq.question}</h3>
              <p className="mt-2 max-w-4xl text-base leading-7 text-copy-muted">{faq.answer}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 border-y border-brand/35 bg-brand/10 px-0 py-8 md:px-6">
          <h3 className="text-2xl font-semibold text-ink">Ready to see your exact quote?</h3>
          <p className="mt-3 max-w-2xl text-sm text-copy-muted">
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
        </div>
      </div>
    </section>
  </div>
);
