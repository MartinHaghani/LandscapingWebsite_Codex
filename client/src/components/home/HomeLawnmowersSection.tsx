const valueHighlights = [
  {
    icon: 'measure',
    title: 'Crisp, even results',
    description:
      'Clean lines, sharp edges, and a uniform cut that keeps your lawn looking professionally maintained.'
  },
  {
    icon: 'signal',
    title: 'Dependable weekly schedule',
    description:
      'Your lawn is serviced on a steady weekly cadence from May through September — no chasing, no no-shows.'
  },
  {
    icon: 'flask',
    title: 'Local & fully insured',
    description:
      'A trusted local team serving the Vaughan area, fully insured and accountable for every visit.'
  },
  {
    icon: 'shield',
    title: 'Satisfaction guaranteed',
    description:
      'If something is not right, we make it right. Your lawn, finished to a standard you will be happy with.'
  }
] as const;

type ValueHighlightIcon = (typeof valueHighlights)[number]['icon'];

const ValuePointIcon = ({ icon }: { icon: ValueHighlightIcon }) => {
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
        <path d="M7.75 12.25v6" />
        <path d="M12 7.75v10.5" />
        <path d="M16.25 10.25v8" />
        <path d="M4.75 18.25h14.5" />
      </svg>
    );
  }

  if (icon === 'flask') {
    return (
      <svg {...commonProps}>
        <path d="M12 21s6.25-5.2 6.25-10.25a6.25 6.25 0 1 0-12.5 0C5.75 15.8 12 21 12 21Z" />
        <circle cx="12" cy="10.75" r="2.35" />
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
    data-home-why-section="true"
  >
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/30 to-transparent" />
    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/55 to-transparent" />
    <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 md:gap-12 md:px-8 md:py-20 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-center">
      <div className="contents lg:relative lg:z-10 lg:order-1 lg:block">
        <div className="order-1 max-w-3xl lg:order-none">
          <h2 className="text-balance font-display text-[1.7rem] font-bold leading-tight tracking-tight text-ink md:text-5xl md:leading-tight">
            Why homeowners choose Autoscape
          </h2>
        </div>

        <div className="order-3 lg:order-none">
        <div className="mt-0 border-y border-stroke/80 lg:mt-10" data-home-why-points="true">
          {valueHighlights.map((highlight) => (
            <div
              key={highlight.title}
              className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4 border-b border-stroke/70 py-5 last:border-b-0"
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-brand/25 bg-brand/10 text-brand"
                data-home-why-icon={highlight.icon}
              >
                <ValuePointIcon icon={highlight.icon} />
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
          Steady weekly care, disciplined finishing, and premium curb appeal without the hassle of
          managing it yourself or chasing an unreliable crew.
        </p>
        </div>
      </div>

      <div
        className="relative order-2 flex items-center justify-center pb-4 pt-2 lg:order-2 lg:justify-end"
        data-home-why-artwork="true"
      >
        <div className="absolute inset-x-10 bottom-12 h-px bg-gradient-to-r from-transparent via-brand/35 to-transparent" />
        <div className="absolute bottom-6 right-8 h-20 w-3/4 bg-gradient-to-t from-ink/10 to-transparent blur-2xl" />
        <div className="relative w-full max-w-[42rem] overflow-hidden rounded-2xl border border-stroke/80 bg-white/70 shadow-[0_34px_56px_-44px_rgba(16,23,19,0.4)] lg:translate-x-6">
          <img
            src="/images/gallery/gallery-03.png"
            alt="A front lawn transformed by a professional weekly mowing service"
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      </div>
    </div>
  </section>
);
