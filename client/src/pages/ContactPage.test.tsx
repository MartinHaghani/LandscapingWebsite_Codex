import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ContactPage } from './ContactPage';

describe('ContactPage', () => {
  it('promotes direct phone and email contact while keeping the message form', () => {
    const markup = renderToStaticMarkup(<ContactPage />);

    expect(markup).toContain('Talk to the Autoscape Team');
    expect(markup).toContain('Reach the team directly');
    expect(markup).toContain('href="tel:+14168482841"');
    expect(markup).toContain('+1 (416) 848-2841');
    expect(markup).toContain('href="mailto:contact@autoscape.ca"');
    expect(markup).toContain('contact@autoscape.ca');
    expect(markup).toContain('font-display text-2xl font-bold');
    expect(markup).toContain('rounded-lg border border-stroke/80');
    expect(markup).not.toContain('Call Autoscape');
    expect(markup).not.toContain('Email the team');
    expect(markup).not.toContain('Direct contact');
    expect(markup).not.toContain('Talk to Autoscape</h2>');
    expect(markup).toContain('Send a message');
    expect(markup).toContain('Name, email, phone, and message are required.');
  });
});
