import type { ContactRecord, QuoteRecord } from '../types.js';

const quotes = new Map<string, QuoteRecord>();
const contacts = new Map<string, ContactRecord>();

export const store = {
  saveQuote(quote: QuoteRecord) {
    quotes.set(quote.id, quote);
    return quote;
  },
  getQuote(id: string) {
    return quotes.get(id) ?? null;
  },
  saveContact(contact: ContactRecord) {
    contacts.set(contact.id, contact);
    return contact;
  }
};
