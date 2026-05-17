export const HomeMowerActionSection = () => (
  <section
    id="results"
    className="relative overflow-hidden border-b border-stroke bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,244,238,0.72))]"
    data-home-results="true"
  >
    <div className="mx-auto w-full max-w-6xl px-4 py-12 md:px-8 md:py-14">
      <div className="grid gap-6 border-y border-stroke/80 py-6 md:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] md:items-center md:gap-8 md:py-7">
        <div className="mx-auto max-w-xl text-center md:mx-0 md:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Real Results</p>
          <h2 className="mt-3 text-balance font-display text-[1.55rem] font-bold leading-tight text-ink md:text-4xl">
            Reliable. Consistent. Every Time.
          </h2>
          <p className="mt-4 text-sm leading-6 text-copy-muted md:text-base md:leading-7">
            The same clean, even cut every single week. No rushed jobs and no missed spots, just
            steady and reliable maintenance that keeps your lawn looking sharp without you having
            to think about it.
          </p>
        </div>

        <div
          className="overflow-hidden rounded-lg border border-stroke/80 bg-white/70 shadow-[0_20px_44px_-40px_rgba(16,23,19,0.32)]"
          data-home-results-media="true"
        >
          <div className="aspect-[1208/680] overflow-hidden">
            <img
              className="h-full w-full origin-top-left scale-[1.025] object-cover"
              src="/images/gallery/gallery-04.png"
              alt="A residential lawn before and after a professional mowing visit"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
);
