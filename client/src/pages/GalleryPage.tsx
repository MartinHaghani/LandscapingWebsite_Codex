import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { SectionTitle } from '../components/ui/SectionTitle';

type GalleryItem = {
  id: number;
  city: 'Vaughan, ON' | 'Richmond Hill, ON';
  src: string;
  alt: string;
};

export const galleryItems: GalleryItem[] = [
  {
    id: 7,
    city: 'Richmond Hill, ON',
    src: '/images/gallery/gallery-07.png',
    alt: 'Before and after shaded front lawn service in Richmond Hill'
  },
  {
    id: 8,
    city: 'Richmond Hill, ON',
    src: '/images/gallery/gallery-08.png',
    alt: 'Before and after curved walkway lawn detail in Richmond Hill'
  },
  {
    id: 9,
    city: 'Richmond Hill, ON',
    src: '/images/gallery/gallery-09.png',
    alt: 'Before and after large frontage lawn cut in Richmond Hill'
  },
  {
    id: 1,
    city: 'Vaughan, ON',
    src: '/images/gallery/gallery-01.png',
    alt: 'Before and after front walk lawn restoration in Vaughan'
  },
  {
    id: 2,
    city: 'Vaughan, ON',
    src: '/images/gallery/gallery-02.png',
    alt: 'Before and after estate front lawn recovery in Vaughan'
  },
  {
    id: 3,
    city: 'Vaughan, ON',
    src: '/images/gallery/gallery-03.png',
    alt: 'Before and after curbside lawn cleanup in Vaughan'
  },
  {
    id: 4,
    city: 'Vaughan, ON',
    src: '/images/gallery/gallery-04.png',
    alt: 'Before and after corner lot lawn finish in Vaughan'
  },
  {
    id: 5,
    city: 'Vaughan, ON',
    src: '/images/gallery/gallery-05.png',
    alt: 'Before and after entry lawn refresh in Vaughan'
  },
  {
    id: 6,
    city: 'Vaughan, ON',
    src: '/images/gallery/gallery-06.png',
    alt: 'Before and after driveway edge lawn cleanup in Vaughan'
  }
];

export const GalleryPage = () => (
  <div className="border-b border-stroke bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,244,238,0.74))]">
    <div className="mx-auto w-full max-w-7xl px-4 py-16 md:px-8 md:py-20">
      <div className="max-w-4xl">
        <SectionTitle
          badge="Gallery"
          title="Before and after lawn work, kept simple"
          description="A focused look at real residential transformations across Vaughan and Richmond Hill, from overgrown edges to clean, repeatable curb appeal."
        />
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {galleryItems.map((item) => (
          <article
            key={item.src}
            className="overflow-hidden rounded-lg border border-stroke bg-white/86 shadow-[0_20px_48px_-42px_rgba(16,23,19,0.34)]"
          >
            <div className="aspect-[3/2] overflow-hidden bg-surface-muted">
              <img
                src={item.src}
                alt={item.alt}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </div>

            <div className="flex min-h-[4.25rem] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
              <p className="text-sm font-semibold text-ink">{item.city}</p>
              <span className="rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-brand">
                Before / After
              </span>
            </div>
          </article>
        ))}
      </div>

      <section className="mt-14 border-y border-brand/30 bg-brand/10 px-0 py-8 md:px-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-ink">Ready to clean up your lawn?</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-copy-muted">
              Start with an instant quote or send the team a note if you want help with your
              property details.
            </p>
          </div>
          <div className="flex flex-col gap-3 min-[390px]:flex-row md:shrink-0">
            <Link to="/instant-quote">
              <Button className="w-full min-[390px]:w-auto">Get Instant Quote</Button>
            </Link>
            <Link to="/contact">
              <Button variant="secondary" className="w-full min-[390px]:w-auto">
                Contact
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  </div>
);
