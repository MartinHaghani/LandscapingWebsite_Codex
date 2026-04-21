const mowerHighlights = [
  {
    title: 'Centimetre precision',
    description:
      'Keeps repeat passes disciplined around planned lawn boundaries, edges, and finished zones.'
  },
  {
    title: '5 sensor types',
    description:
      'Uses layered sensing to stay aware of position, route progress, surroundings, and changing conditions.'
  },
  {
    title: 'Tested rigorously',
    description:
      'Validated for repeatable weekly operation so cut quality stays consistent across the season.'
  },
  {
    title: 'Built-in safety features',
    description:
      'Designed with responsive stop and awareness systems to protect people, pets, and property.'
  }
] as const;

export const HomeLawnmowersSection = () => (
  <section
    className="relative overflow-hidden border-b border-stroke bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,244,238,0.78))]"
    data-home-mowers-section="true"
  >
    <div className="absolute -right-24 top-10 h-72 w-72 rounded-full bg-brand/12 blur-3xl" />
    <div className="absolute bottom-0 right-10 h-80 w-80 rounded-full bg-ink/5 blur-3xl" />
    <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-20 md:px-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-center">
      <div className="relative z-10">
        <div className="max-w-3xl">
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink md:text-5xl">
            Meet our lawnmowers
          </h2>
          <p className="mt-4 text-base text-copy-muted md:text-lg">
            Autoscape mowers combine repeatable route execution, property-aware sensing, and
            disciplined coverage to deliver a consistent premium cut week after week.
          </p>
        </div>

        <div className="mt-10 border-y border-stroke/80" data-home-mowers-points="true">
          {mowerHighlights.map((highlight) => (
            <div key={highlight.title} className="border-b border-stroke/70 py-4 last:border-b-0">
              <h3 className="text-base font-semibold text-ink">{highlight.title}</h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-copy-muted">
                {highlight.description}
              </p>
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
        <div className="absolute inset-x-10 top-1/2 h-[58%] -translate-y-1/2 rounded-full bg-brand/14 blur-3xl" />
        <div className="absolute left-16 top-20 h-32 w-32 rounded-full bg-white/70 blur-2xl" />
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
