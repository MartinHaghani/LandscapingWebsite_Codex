import { Link } from 'react-router-dom';
import { HomeLawnmowersSection } from '../components/home/HomeLawnmowersSection';
import { HomeMowerActionSection } from '../components/home/HomeMowerActionSection';
import { HomePricingComparisonSection } from '../components/home/HomePricingComparisonSection';
import { Card } from '../components/ui/Card';
import { SectionTitle } from '../components/ui/SectionTitle';
import { Button } from '../components/ui/Button';

const faqs = [
  {
    question: 'How often do you mow?',
    answer: (
      <>
        Service runs <strong className="font-semibold text-ink">weekly</strong> with around{' '}
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
    question: 'Is your service safe for kids and pets?',
    answer: (
      <>
        <strong className="font-semibold text-ink">Safety matters.</strong> As with any lawn
        care work, <strong className="font-semibold text-ink">normal caution</strong> is important
        on service days. We will review the right setup and{' '}
        <strong className="font-semibold text-ink">best practices</strong> for your property so your
        family and pets stay comfortable around every visit.
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
        <div className="flex flex-col gap-7 md:grid md:min-h-0 md:flex-1 md:grid-cols-2 md:items-center md:gap-10">
          <div className="contents md:order-1 md:flex md:h-full md:items-center">
            <div className="contents md:block md:w-full md:max-w-[30rem]">
              <div className="fade-up order-1 w-full max-w-[30rem] md:order-none md:max-w-none">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
                  Premium Lawn Care
                </p>
                <h1 className="mt-4 text-balance font-display text-[2.35rem] font-bold leading-[1.08] text-ink md:text-6xl">
                  A Lawn You'll Love
                </h1>
                <p className="mt-5 max-w-xl text-base text-copy-muted md:mt-6 md:text-lg">
                  Reliable weekly mowing, edging, and clean up for an affordable price
                </p>
              </div>
              <div className="fade-up order-3 w-full max-w-[30rem] md:order-none md:mt-7 md:max-w-none">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <div className="w-full sm:w-auto">
                    <Link to="/instant-quote">
                      <Button className="w-full sm:w-auto md:px-7 md:py-3.5 md:text-base">
                        Get Instant Quote
                      </Button>
                    </Link>
                  </div>
                  <Link to="/contact" className="w-full sm:w-auto">
                    <Button
                      variant="secondary"
                      className="w-full sm:w-auto md:px-7 md:py-3.5 md:text-base"
                    >
                      Call or Send a Message
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div
            className="fade-up order-2 flex min-h-0 items-center justify-center md:order-2 md:h-full [animation-delay:120ms]"
            data-home-hero-media="true"
          >
            <div className="relative w-full max-w-[34rem]">
              <div className="overflow-hidden rounded-2xl border border-stroke/80 bg-white/70 shadow-[0_30px_60px_-38px_rgba(16,23,19,0.45)]">
                <img
                  src="/images/gallery/gallery-08.png"
                  alt="A Vaughan front lawn before and after a professional mowing service"
                  className="h-full w-full object-cover"
                  loading="eager"
                />
              </div>
              <div
                className="absolute -bottom-5 left-5 flex items-center gap-3 rounded-full border border-white/70 bg-white/90 px-4 py-2.5 shadow-[0_22px_40px_-30px_rgba(16,23,19,0.45)] backdrop-blur md:left-7"
                data-home-hero-badge="true"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/15 text-brand">
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.9}
                    viewBox="0 0 24 24"
                  >
                    <path d="m5 12.5 4.2 4.2L19 7" />
                  </svg>
                </span>
                <span className="text-sm font-semibold text-ink">
                  Trusted by Vaughan homeowners
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <HomePricingComparisonSection />
    <HomeMowerActionSection />
    <HomeLawnmowersSection />

    <section className="border-b border-stroke bg-[linear-gradient(180deg,rgba(247,244,238,0.76),rgba(255,255,255,0.96))]">
      <div className="mx-auto w-full max-w-7xl px-4 py-14 md:px-8 md:py-20">
        <SectionTitle
          badge="Services"
          title="Maintenance designed for premium residential properties"
          description="Dependable weekly mowing is the foundation, with finishing work and seasonal tuning for consistent quality."
        />

        <div className="mt-8 grid gap-5 md:mt-10 md:gap-6 md:grid-cols-3">
          <Card className="rounded-lg bg-white/85 shadow-[0_18px_44px_-40px_rgba(16,23,19,0.3)]">
            <h3 className="text-xl font-semibold text-ink">Weekly Mowing</h3>
            <p className="mt-3 text-sm text-copy-muted">
              A clean, even cut on a reliable weekly schedule for uniform color and healthy
              growth all season long.
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
      <div className="mx-auto w-full max-w-7xl px-4 py-14 md:px-8 md:py-20">
        <SectionTitle
          badge="FAQ"
          title="Common questions"
          description="Answers to the questions most customers ask before starting instant quote."
        />
        <div className="mt-8 divide-y divide-stroke/80 border-y border-stroke/80 md:mt-10">
          {faqs.map((faq) => (
            <div key={faq.question} className="py-5">
              <h3 className="text-base font-semibold text-ink md:text-lg">{faq.question}</h3>
              <p className="mt-2 max-w-4xl text-[0.95rem] leading-7 text-copy-muted md:text-base">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-brand/35 bg-brand/10 px-5 py-7 md:mt-12 md:rounded-none md:border-x-0 md:px-6 md:py-8">
          <h3 className="text-xl font-semibold text-ink md:text-2xl">
            Ready to see your exact quote?
          </h3>
          <p className="mt-3 max-w-2xl text-sm text-copy-muted">
            Start with your address, map your property boundaries, and receive a deterministic
            estimate in minutes.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
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
