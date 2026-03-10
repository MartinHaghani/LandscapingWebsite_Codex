import { useMemo, useState, type FormEvent } from 'react';
import { Card } from '../components/ui/Card';
import { SectionTitle } from '../components/ui/SectionTitle';
import { Button } from '../components/ui/Button';
import { api, ApiError, createIdempotencyKey } from '../lib/api';
import { getAttributionSnapshot } from '../lib/attribution';

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  address: '',
  message: ''
};

export const ContactPage = () => {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const canSubmit = useMemo(
    () =>
      form.name.trim().length > 1 &&
      form.email.includes('@') &&
      form.phone.trim().length >= 7 &&
      form.message.trim().length > 7,
    [form]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await api.submitContact({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        addressText: form.address.trim() || undefined,
        message: form.message.trim(),
        attribution: getAttributionSnapshot()
      }, createIdempotencyKey());
      setResult({
        type: 'success',
        message: `Message received. Confirmation ID: ${response.id}`
      });
      setForm(emptyForm);
    } catch (error) {
      setResult({
        type: 'error',
        message: error instanceof ApiError ? error.message : 'Unable to submit contact request.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-16 md:px-8 md:py-20">
      <SectionTitle
        badge="Contact"
        title="Send us a message"
      />

      <div className="mt-10 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="bg-black/45">
          <h3 className="text-xl font-semibold text-white">Autoscape HQ</h3>
          <p className="mt-3 text-sm text-white/70">Phone: +1 4168482841</p>
          <p className="mt-2 text-sm text-white/70">Email: contact@autoscape.ca</p>
        </Card>

        <Card>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="name" className="mb-2 block text-sm text-white/80">
                Name
              </label>
              <input
                id="name"
                required
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="w-full rounded-xl border border-white/20 bg-black/50 px-4 py-3 text-white placeholder:text-white/35 focus:border-brand focus:outline-none"
                placeholder="Placeholder: Jane Doe"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-2 block text-sm text-white/80">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="w-full rounded-xl border border-white/20 bg-black/50 px-4 py-3 text-white placeholder:text-white/35 focus:border-brand focus:outline-none"
                placeholder="Placeholder: jane@example.com"
              />
            </div>

            <div>
              <label htmlFor="phone" className="mb-2 block text-sm text-white/80">
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                required
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                className="w-full rounded-xl border border-white/20 bg-black/50 px-4 py-3 text-white placeholder:text-white/35 focus:border-brand focus:outline-none"
                placeholder="+1 416 000 0000"
              />
            </div>

            <div>
              <label htmlFor="address" className="mb-2 block text-sm text-white/80">
                Address (optional)
              </label>
              <input
                id="address"
                value={form.address}
                onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                className="w-full rounded-xl border border-white/20 bg-black/50 px-4 py-3 text-white placeholder:text-white/35 focus:border-brand focus:outline-none"
                placeholder="Enter your property address"
              />
            </div>

            <div>
              <label htmlFor="message" className="mb-2 block text-sm text-white/80">
                Message
              </label>
              <textarea
                id="message"
                rows={5}
                required
                value={form.message}
                onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                className="w-full rounded-xl border border-white/20 bg-black/50 px-4 py-3 text-white placeholder:text-white/35 focus:border-brand focus:outline-none"
                placeholder="Placeholder: Tell us about your property and service goals."
              />
            </div>

            {result ? (
              <p className={result.type === 'success' ? 'text-sm text-brand' : 'text-sm text-red-300'}>{result.message}</p>
            ) : null}

            <Button type="submit" disabled={!canSubmit || loading}>
              {loading ? 'Submitting...' : 'Send message'}
            </Button>
            <p className="text-xs text-white/60">
              Name, email, phone, and message are required. Address is optional, but it helps us answer your query
              better.
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
};
