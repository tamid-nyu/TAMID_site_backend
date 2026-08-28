import { describe, expect, it } from '@jest/globals';
import { checkCaption } from './instagramCaption.js';

describe('checkCaption', () => {
  it('accepts an on-brand recruitment caption', () => {
    const result = checkCaption(
      'Applications for Spring 2027 are open.\n\n' +
        'TAMID at NYU develops undergraduates through hands-on work with the Israeli ' +
        'economy across Investment Fund, Consulting, Quant, and Israel Fellowship.\n\n' +
        'Apply by February 3 — link in bio.\n\n#TAMID #TAMIDatNYU #NYU #Consulting'
    );

    expect(result.ok).toBe(true);
    expect(result.blocking).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('blocks political framing', () => {
    const result = checkCaption('Join our rally about the election and the ongoing war.');

    expect(result.ok).toBe(false);
    expect(result.blocking[0]).toMatch(/apolitical and areligious/);
  });

  it('blocks religious framing', () => {
    const result = checkCaption('Celebrate Shabbat with our Jewish community!');

    expect(result.ok).toBe(false);
    expect(result.blocking[0]).toMatch(/apolitical and areligious/);
  });

  it('blocks the retired "Education" pillar', () => {
    const result = checkCaption(
      'Our four programs: Education, Consulting, Investment Fund, and Israel Fellowship.'
    );

    expect(result.ok).toBe(false);
    expect(result.blocking.some((issue) => issue.includes('Education'))).toBe(true);
  });

  it('warns on filler, excess emoji and shouting without blocking', () => {
    const result = checkCaption('We are thrilled to announce our game-changing event!!! 🎉🎊🔥🚀');

    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => w.includes('Filler phrasing'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('emoji'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('exclamation'))).toBe(true);
  });

  it('warns when a recruitment caption names no program', () => {
    const result = checkCaption('Applications are open. Apply now via the link in bio.');

    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => w.includes('names no program'))).toBe(true);
  });

  it('warns when the hook exceeds the feed truncation point', () => {
    const result = checkCaption(`${'a'.repeat(140)}\nsecond line`);

    expect(result.warnings.some((w) => w.includes('truncates'))).toBe(true);
  });

  it('counts words and hashtags', () => {
    const result = checkCaption('Consulting engagements with Israeli startups. #TAMID #NYU');

    expect(result.words).toBe(7);
    expect(result.hashtags).toBe(2);
  });
});
