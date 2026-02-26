interface PlaceholderImageProps {
  label: string;
  heightClassName?: string;
}

export const PlaceholderImage = ({ label, heightClassName = 'h-56' }: PlaceholderImageProps) => (
  <div
    className={`${heightClassName} relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-[#0f1713] via-[#122219] to-[#07110c]`}
  >
    <div className="absolute -left-14 top-1/3 h-28 w-28 rounded-full bg-brand/35 blur-3xl" />
    <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
    <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
      {label}
    </div>
  </div>
);
