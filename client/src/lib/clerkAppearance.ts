export const autoscapeClerkAppearance = {
  variables: {
    colorPrimary: '#329F5B',
    colorText: '#101713',
    colorTextSecondary: '#5f6f64',
    colorBackground: '#fffdf8',
    colorInputBackground: '#fffdf8',
    colorInputText: '#101713',
    borderRadius: '0.9rem',
    fontFamily: 'Sora, system-ui, sans-serif',
    fontFamilyButtons: 'Sora, system-ui, sans-serif'
  },
  elements: {
    rootBox: 'w-full',
    card: 'w-full rounded-[1.75rem] border border-stroke bg-surface shadow-soft sm:rounded-[2rem]',
    headerTitle: 'font-display text-2xl font-bold text-ink',
    headerSubtitle: 'text-sm leading-6 text-copy-muted',
    socialButtonsBlockButton:
      'min-h-[44px] rounded-full border border-stroke bg-surface text-sm font-semibold text-ink hover:border-brand',
    dividerLine: 'bg-stroke',
    dividerText: 'text-copy-muted',
    formFieldLabel: 'text-sm font-semibold text-ink',
    formFieldInput:
      'min-h-[46px] rounded-xl border border-stroke bg-surface px-4 text-base text-ink shadow-none focus:border-brand focus:ring-2 focus:ring-brand/25',
    formButtonPrimary:
      'min-h-[48px] rounded-full bg-brand text-sm font-semibold text-ink shadow-soft hover:bg-brand-muted',
    footerActionLink: 'font-semibold text-ink hover:text-brand',
    footer: 'text-sm text-copy-muted',
    identityPreviewText: 'text-ink',
    profileSectionTitleText: 'text-ink',
    navbarButton: 'text-copy-muted hover:text-brand'
  }
} as const;
