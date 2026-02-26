import { useMemo, useState, type FormEvent } from 'react';
import { Card } from '../components/ui/Card';
import { SectionTitle } from '../components/ui/SectionTitle';
import { Button } from '../components/ui/Button';
import { api, ApiError } from '../lib/api';

const emptyForm = {
  name: '',
  email: '',
  message: ''
};

export const ContactPage = () => {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const canSubmit = useMemo(
    () => form.name.trim().length > 1 && form.email.includes('@') && form.message.trim().length > 7,
    [form]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await api.submitContact(form);
      setResult({
        type: 'success',
        message: `Message received. Placeholder confirmation ID: ${response.id}`
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
        description="Placeholder form for inquiries, demos, and enterprise property onboarding."
      />

      <div className="mt-10 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="bg-black/45">
          <h3 className="text-xl font-semibold text-white">Autoscape HQ</h3>
          <p className="mt-3 text-sm text-white/70">Placeholder: 100 Innovation Loop, Smart City, USA</p>
          <p className="mt-2 text-sm text-white/70">Placeholder: +1 (000) 123-4567</p>
          <p className="mt-2 text-sm text-white/70">Placeholder: hello@autoscape.example</p>
        </Card>

        <Card>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="name" className="mb-2 block text-sm text-white/80">
                Name
              </label>
              <input
                id="name"
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
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="w-full rounded-xl border border-white/20 bg-black/50 px-4 py-3 text-white placeholder:text-white/35 focus:border-brand focus:outline-none"
                placeholder="Placeholder: jane@example.com"
              />
            </div>

            <div>
              <label htmlFor="message" className="mb-2 block text-sm text-white/80">
                Message
              </label>
              <textarea
                id="message"
                rows={5}
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
          </form>
        </Card>
      </div>
    </div>
  );
};
