import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const svgPath = fileURLToPath(new URL('./guide-house-background.svg', import.meta.url));
const svgMarkup = readFileSync(svgPath, 'utf8');

describe('guide house background svg asset', () => {
  it('keeps a stable editable viewBox and the required grouped ids', () => {
    expect(svgMarkup).toContain('viewBox="0 0 220 120"');
    expect(svgMarkup).toContain('id="lawn-front-left"');
    expect(svgMarkup).toContain('id="lawn-front-right"');
    expect(svgMarkup).toContain('id="lawn-back"');
    expect(svgMarkup).toContain('id="driveway"');
    expect(svgMarkup).toContain('id="house"');
    expect(svgMarkup).toContain('id="shed"');
    expect(svgMarkup).toContain('id="garden"');
    expect(svgMarkup).toContain('id="deck"');
    expect(svgMarkup).toContain('id="front-tree"');
    expect(svgMarkup).toContain('id="backyard-trees"');
  });

  it('keeps exactly three lawn groups and no text labels', () => {
    expect(svgMarkup.match(/id="lawn-/g) ?? []).toHaveLength(3);
    expect(svgMarkup).not.toMatch(/<text[\s>]/);
  });

  it('keeps the front-left lawn path aligned to the exposed driveway and house edges', () => {
    expect(svgMarkup).toContain('d="M6 58H37L45 74H67L74 74V103H114V114H6V95Z"');
    expect(svgMarkup).not.toContain('d="M6 57H43L49 64L58 72H74V103H114V114H6Z"');
  });
});
