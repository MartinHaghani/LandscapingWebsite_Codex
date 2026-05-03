import { useMemo, useState, type FormEvent } from 'react';
import { Card } from '../components/ui/Card';
import { SectionTitle } from '../components/ui/SectionTitle';
import { Button } from '../components/ui/Button';
import { LegalAgreementCheckbox, LegalDocumentLinks } from '../components/legal/LegalAgreementCheckbox';
import { api, ApiError, createIdempotencyKey } from '../lib/api';
import { trackAnalyticsEvent } from '../lib/analytics';
import { getAttributionSnapshot } from '../lib/attribution';
import { legalAcceptancePayload, legalDocumentSlugs } from '../lib/legalAcceptance';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[0-9+().\-\s]{7,40}$/;

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  address: '',
  message: ''
};

const contactMethods = [
  {
    label: 'Call Autoscape',
    value: '+1 (416) 848-2841',
    href: 'tel:+14168482841',
    helper: 'Best for quote help, scheduling, and urgent service questions.',
    icon: 'phone'
  },
  {
    label: 'Email the team',
    value: 'contact@autoscape.ca',
    href: 'mailto:contact@autoscape.ca',
    helper: 'Best for property details, documents, and follow-up questions.',
    icon: 'mail'
  }
] as const;

type ContactMethodIcon = (typeof contactMethods)[number]['icon'];

const ContactIcon = ({ icon }: { icon: ContactMethodIcon }) => {
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

  if (icon === 'phone') {
    return (
      <svg {...commonProps}>
        <path d="M6.65 4.75 9.2 4.1l1.75 4.55-1.7 1.02a9.2 9.2 0 0 0 5.08 5.08l1.02-1.7 4.55 1.75-.65 2.55a2.25 2.25 0 0 1-2.4 1.67C9.9 18.42 5.58 14.1 4.98 7.15a2.25 2.25 0 0 1 1.67-2.4Z" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M4.75 6.75h14.5v10.5H4.75Z" />
      <path d="m5.25 7.25 6.75 5.5 6.75-5.5" />
    </svg>
  );
};

export const ContactPage = () => {
  const [form, setForm] = useState(emptyForm);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [startedTracked, setStartedTracked] = useState(false);

  const canSubmit = useMemo(
    () =>
      form.name.trim().length > 1 &&
      emailPattern.test(form.email.trim()) &&
      phonePattern.test(form.phone.trim()) &&
      form.message.trim().length > 7 &&
      privacyAccepted,
    [form, privacyAccepted]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await api.submitContact(
        {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          addressText: form.address.trim() || undefined,
          message: form.message.trim(),
          marketingConsent,
          attribution: getAttributionSnapshot(),
          legalAcceptance: legalAcceptancePayload
        },
        createIdempotencyKey()
      );
      setResult({
        type: 'success',
        message: `Message received. Confirmation ID: ${response.id}`
      });
      trackAnalyticsEvent('contact.submitted', {
        properties: {
          marketingConsent,
          hasAddress: form.address.trim().length > 0
        }
      });
      setForm(emptyForm);
      setMarketingConsent(false);
      setPrivacyAccepted(false);
    } catch (error) {
      setResult({
        type: 'error',
        message: error instanceof ApiError ? error.message : 'Unable to submit contact request.'
      });
    } finally {
      setLoading(false);
    }
  };

  const trackContactStarted = () => {
    if (startedTracked) {
      return;
    }

    setStartedTracked(true);
    trackAnalyticsEvent('contact.started');
  };

  return (
    <div className="border-b border-stroke bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,244,238,0.72))]">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 md:px-8 md:py-20">
        <SectionTitle
          badge="Contact"
          title="Talk to the Autoscape Team"
          description="Need help with service coverage, quote setup, or account follow-up? Call, email, or send the details here."
        />

        <div className="mt-10 grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
          <section
            className="rounded-lg border border-stroke/80 bg-white/70 p-5 shadow-[0_18px_44px_-40px_rgba(16,23,19,0.24)] md:bg-surface/80 md:p-6"
            aria-labelledby="direct-contact-heading"
          >
            <h2 id="direct-contact-heading" className="text-2xl font-semibold text-ink">
              Reach the team directly
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-copy-muted">
              Phone and email are monitored during service hours for customers starting quotes,
              checking coverage, or following up on a property request.
            </p>

            <div className="mt-6 divide-y divide-stroke/80 border-y border-stroke/80">
              {contactMethods.map((method) => (
                <a
                  key={method.href}
                  href={method.href}
                  onClick={() =>
                    trackAnalyticsEvent('contact.action_clicked', {
                      properties: {
                        channel: method.icon
                      }
                    })
                  }
                  className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-4 py-5 transition-colors hover:text-brand sm:grid-cols-[3rem_minmax(0,1fr)]"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-brand/25 bg-brand/10 text-brand">
                    <ContactIcon icon={method.icon} />
                  </span>
                  <span>
                    <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-brand">
                      {method.label}
                    </span>
                    <span className="mt-1 block break-words text-base font-semibold leading-snug text-ink sm:text-lg">
                      {method.value}
                    </span>
                    <span className="mt-2 block text-sm leading-6 text-copy-muted">
                      {method.helper}
                    </span>
                  </span>
                </a>
              ))}
            </div>

            <dl className="mt-6 grid gap-4 border-y border-stroke/80 py-5 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-copy-soft">
                  Service region
                </dt>
                <dd className="mt-1 font-semibold text-ink">Greater Toronto Area</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-copy-soft">
                  Hours
                </dt>
                <dd className="mt-1 font-semibold text-ink">Mon-Sat 7:00 AM - 7:00 PM</dd>
              </div>
            </dl>
          </section>

          <Card className="rounded-lg bg-white/90 shadow-[0_20px_48px_-40px_rgba(16,23,19,0.28)]">
            <h2 className="text-2xl font-semibold text-ink">Send a message</h2>
            <p className="mt-2 text-sm leading-6 text-copy-muted">
              Share the essentials and we will route your note to the right person.
            </p>
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="name" className="form-label">
                  Name
                </label>
                <input
                  id="name"
                  required
                  value={form.name}
                  onChange={(event) => {
                    trackContactStarted();
                    setForm((current) => ({ ...current, name: event.target.value }));
                  }}
                  autoComplete="name"
                  className="form-input"
                  placeholder="Jane Doe"
                />
              </div>

              <div>
                <label htmlFor="email" className="form-label">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(event) => {
                    trackContactStarted();
                    setForm((current) => ({ ...current, email: event.target.value }));
                  }}
                  autoComplete="email"
                  className="form-input"
                  placeholder="jane@example.com"
                />
              </div>

              <div>
                <label htmlFor="phone" className="form-label">
                  Phone
                </label>
                <input
                  id="phone"
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(event) => {
                    trackContactStarted();
                    setForm((current) => ({ ...current, phone: event.target.value }));
                  }}
                  autoComplete="tel"
                  className="form-input"
                  placeholder="+1 416 000 0000"
                />
              </div>

              <div>
                <label htmlFor="address" className="form-label">
                  Address (optional)
                </label>
                <input
                  id="address"
                  value={form.address}
                  onChange={(event) => {
                    trackContactStarted();
                    setForm((current) => ({ ...current, address: event.target.value }));
                  }}
                  autoComplete="street-address"
                  className="form-input"
                  placeholder="123 Greenway Blvd, Vaughan, ON"
                />
              </div>

              <div>
                <label htmlFor="message" className="form-label">
                  Message
                </label>
                <textarea
                  id="message"
                  rows={5}
                  required
                  value={form.message}
                  onChange={(event) => {
                    trackContactStarted();
                    setForm((current) => ({ ...current, message: event.target.value }));
                  }}
                  className="form-input min-h-[140px]"
                  placeholder="Tell us about your property, service goals, or any timeline requirements."
                />
              </div>

              <label
                htmlFor="email-marketing-consent"
                className="flex gap-3 rounded-lg border border-stroke bg-surface-raised/60 px-4 py-3 text-sm leading-6 text-copy-muted"
              >
                <input
                  id="email-marketing-consent"
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(event) => setMarketingConsent(event.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-brand"
                />
                <span>
                  Email me Autoscape updates and offers. This is optional and separate from service
                  or quote messages.
                </span>
              </label>

              <LegalAgreementCheckbox
                id="contact-privacy-acknowledgement"
                checked={privacyAccepted}
                onChange={setPrivacyAccepted}
                documentSlugs={legalDocumentSlugs.contactPrivacy}
              >
                I have read the <LegalDocumentLinks documentSlugs={legalDocumentSlugs.contactPrivacy} /> and agree
                that Autoscape may use my information to respond to this request.
              </LegalAgreementCheckbox>

              {result ? (
                <p
                  className={
                    result.type === 'success' ? 'text-sm text-brand' : 'text-sm text-red-700'
                  }
                >
                  {result.message}
                </p>
              ) : null}

              <Button type="submit" disabled={!canSubmit || loading}>
                {loading ? 'Submitting...' : 'Send message'}
              </Button>
              <p className="form-help">
                Name, email, phone, and message are required. Address is optional, but it helps us
                answer your query better.
              </p>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};
