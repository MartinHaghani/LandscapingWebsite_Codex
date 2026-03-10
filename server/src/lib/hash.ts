import { createHash } from 'node:crypto';

const normalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => normalize(item));
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => [key, normalize(nested)]);

    return Object.fromEntries(entries);
  }

  return value;
};

export const stableStringify = (value: unknown) => JSON.stringify(normalize(value));

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export const hashJson = (value: unknown) => sha256(stableStringify(value));
