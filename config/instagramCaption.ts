/**
 * Deterministic checks against the chapter's caption rules.
 *
 * A backstop rather than a substitute for judgement: it catches the mistakes
 * that are cheap to detect and expensive to publish. `blocking` issues prevent
 * a post from being staged; `warnings` are surfaced for a human to weigh.
 */

// TAMID is nationally apolitical and areligious. These terms are not forbidden
// words in themselves -- they signal that a caption has drifted into framing
// the chapter politically or religiously, which is the mistake with real
// consequences for the club. A hit means a human re-reads before publishing.
const SENSITIVE = [
  'politic',
  'election',
  'vote',
  'protest',
  'war',
  'conflict',
  'gaza',
  'hamas',
  'idf',
  'military',
  'zionis',
  'occupation',
  'ceasefire',
  'activism',
  'activist',
  'rally',
  'religio',
  'jewish',
  'judaism',
  'torah',
  'synagogue',
  'shabbat',
  'kosher',
  'islam',
  'muslim',
  'christian',
  'palestin',
];

const HYPE = [
  'thrilled to announce',
  'excited to share',
  'excited to announce',
  'game-changing',
  'game changing',
  'revolutionary',
  'world-class',
  'unprecedented',
  'beyond excited',
  'super excited',
];

const PROGRAMS = ['investment fund', 'consulting', 'quant', 'israel fellowship'];

/** Instagram truncates roughly here in the feed. */
const HOOK_LIMIT = 125;

export interface CaptionCheck {
  ok: boolean;
  blocking: string[];
  warnings: string[];
  words: number;
  hashtags: number;
}

const countEmoji = (text: string): number =>
  (text.match(/\p{Extended_Pictographic}/gu) ?? []).length;

export const checkCaption = (caption: string): CaptionCheck => {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const lower = caption.toLowerCase();

  const hits = SENSITIVE.filter((t) => lower.includes(t));
  if (hits.length > 0) {
    blocking.push(
      `Possible political or religious framing (matched: ${hits.join(', ')}). ` +
        'TAMID is apolitical and areligious — rewrite around the business and ' +
        'professional-development angle, or confirm this is a false positive.'
    );
  }

  // "Education" was a pillar in an older brand doc; the chapter runs Quant.
  if (/\beducation program\b|\bfour programs?\b[^.]*\beducation\b/i.test(caption)) {
    blocking.push(
      'Refers to "Education" as a program. The four are Investment Fund, ' +
        'Consulting, Quant, and Israel Fellowship.'
    );
  }

  const words = caption.trim().split(/\s+/).filter(Boolean).length;
  if (words > 200) {
    warnings.push(`Caption is ${words} words; most posts read best under 120.`);
  }

  const firstLine = caption.trim().split('\n')[0] ?? '';
  if (firstLine.length > HOOK_LIMIT) {
    warnings.push(
      `First line is ${firstLine.length} characters. Instagram truncates around ` +
        `${HOOK_LIMIT}, so the hook and the ask should fit within it.`
    );
  }

  const tags = caption.match(/#[\w]+/g) ?? [];
  if (tags.length > 0 && (tags.length < 3 || tags.length > 6)) {
    warnings.push(`${tags.length} hashtags; the chapter's range is 3-6.`);
  }

  const emoji = countEmoji(caption);
  if (emoji > 2) {
    warnings.push(`${emoji} emoji; keep to two or fewer, and only functional ones.`);
  }

  const hype = HYPE.filter((p) => lower.includes(p));
  if (hype.length > 0) {
    warnings.push(`Filler phrasing: ${hype.join(', ')}.`);
  }

  if (/!{2,}/.test(caption)) {
    warnings.push('Multiple exclamation marks read as hype.');
  }

  const mentionsProgram = PROGRAMS.some((p) => lower.includes(p));
  if (!mentionsProgram && /apply|application|recruit|join/i.test(caption)) {
    warnings.push(
      'Recruitment caption names no program. Say which of Investment Fund, ' +
        'Consulting, Quant, or Israel Fellowship applies.'
    );
  }

  return { ok: blocking.length === 0, blocking, warnings, words, hashtags: tags.length };
};
