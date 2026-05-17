const mowerHighlights = [
  {
    icon: 'measure',
    title: 'Centimetre precision',
    description:
      'Keeps repeat passes disciplined around planned lawn boundaries, edges, and finished zones.'
  },
  {
    icon: 'signal',
    title: '5 sensor types',
    description:
      'Uses sensor fusion to stay aware of position, route progress, surroundings, and changing conditions.'
  },
  {
    icon: 'flask',
    title: 'Rigorously tested',
    description:
      'Validated for repeatable weekly operation so cut quality stays consistent across the season.'
  },
  {
    icon: 'shield',
    title: 'Built-in safety features',
    description:
      'Designed with responsive stop and awareness systems to protect people, pets, and property.'
  }
] as const;

type MowerHighlightIcon = (typeof mowerHighlights)[number]['icon'];

const MowerPointIcon = ({ icon }: { icon: MowerHighlightIcon }) => {
  const commonProps = {
    'aria-hidden': true,
    className: 'h-5 w-5',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
    viewBox: '0 0 24 24'
  };

  if (icon === 'measure') {
    return (
      <svg {...commonProps}>
        <path d="M4.25 8.25h15.5v7.5H4.25Z" />
        <path d="M7.25 8.25v3" />
        <path d="M10.25 8.25v4.25" />
        <path d="M13.25 8.25v3" />
        <path d="M16.25 8.25v4.25" />
        <path d="M4.25 15.75h15.5" />
      </svg>
    );
  }

  if (icon === 'signal') {
    return (
      <svg {...commonProps}>
        <path d="M12 19.25v-3.5" />
        <path d="M7.75 17a6 6 0 0 1 8.5 0" />
        <path d="M4.75 13.9a10.25 10.25 0 0 1 14.5 0" />
        <path d="M2.75 10.75a13.1 13.1 0 0 1 18.5 0" />
        <path d="M12 5.25v1.5" />
      </svg>
    );
  }

  if (icon === 'flask') {
    return (
      <svg {...commonProps}>
        <path d="M9.25 3.75h5.5" />
        <path d="M10.25 3.75v5.5L5.85 17.1a2.1 2.1 0 0 0 1.83 3.15h8.64a2.1 2.1 0 0 0 1.83-3.15l-4.4-7.85v-5.5" />
        <path d="M7.75 15.25h8.5" />
        <path d="M9.25 18.25h5.5" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M12 3.75 18.75 6v5.1c0 4.15-2.55 7.85-6.75 9.15-4.2-1.3-6.75-5-6.75-9.15V6L12 3.75Z" />
      <path d="m9.25 12.25 1.75 1.75 3.85-4.1" />
    </svg>
  );
};

export const HomeLawnmowersSection = () => (
  <section
    className="relative overflow-hidden border-b border-stroke bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,244,238,0.78))]"
    data-home-mowers-section="true"
  >
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/30 to-transparent" />
    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/55 to-transparent" />
    <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-20 md:px-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-center">
      <div className="relative z-10">
        <div className="max-w-3xl">
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink md:text-5xl">
            Meet our lawnmowers
          </h2>
        </div>

        <div className="mt-10 border-y border-stroke/80" data-home-mowers-points="true">
          {mowerHighlights.map((highlight) => (
            <div
              key={highlight.title}
              className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4 border-b border-stroke/70 py-5 last:border-b-0"
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-brand/25 bg-brand/10 text-brand"
                data-home-mower-icon={highlight.icon}
              >
                <MowerPointIcon icon={highlight.icon} />
              </span>
              <div>
                <h3 className="text-base font-semibold text-ink">{highlight.title}</h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-copy-muted">
                  {highlight.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 max-w-2xl text-sm leading-6 text-copy-soft">
          Each mower is tuned for steady route memory, disciplined coverage, and premium curb
          appeal without the disruption of a traditional crew schedule.
        </p>
      </div>

      <div
        className="relative flex items-center justify-center pb-4 pt-2 lg:justify-end"
        data-home-mowers-artwork="true"
      >
        <div className="absolute inset-x-10 bottom-12 h-px bg-gradient-to-r from-transparent via-brand/35 to-transparent" />
        <div className="absolute bottom-6 right-8 h-20 w-3/4 bg-gradient-to-t from-ink/10 to-transparent blur-2xl" />
        <img
          src="/images/home/mower-technology-transparent.png"
          alt="Autoscape autonomous lawnmower"
          className="relative h-auto w-full max-w-[42rem] object-contain drop-shadow-[0_34px_56px_rgba(16,23,19,0.2)] lg:translate-x-6"
          loading="lazy"
        />
      </div>
    </div>
  </section>
);
