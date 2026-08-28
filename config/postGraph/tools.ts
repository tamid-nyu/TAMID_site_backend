import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { getSupabase } from '../supabase.js';
import { checkCaption } from '../instagramCaption.js';
import { postInsights } from '../instagramInsights.js';
import { logger } from '../../logger.js';

/**
 * Tools available to the post-generation graph.
 *
 * Each one is a real capability rather than a prompt instruction: the model
 * decides when to generate an image, when to look at what has performed, and
 * when to check a draft against the chapter's rules. That keeps the brand rules
 * enforced by code rather than by hoping the model remembers them.
 */

const IMAGE_BUCKET = process.env.INSTAGRAM_BUCKET ?? 'event-flyers';

interface XaiImageResponse {
  data?: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>;
  error?: { message?: string };
}

/**
 * Generates an image with Grok and stores it in Supabase.
 *
 * The storage step is not incidental. Instagram fetches the image from a URL
 * itself, and xAI's returned URLs are short-lived, so a generated image has to
 * be re-hosted somewhere public before it can ever be published.
 */
export const generateImage = tool(
  async ({ prompt }: { prompt: string }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return JSON.stringify({
        ok: false,
        error: 'Image generation is unavailable: XAI_API_KEY is not configured.',
      });
    }

    const base = process.env.XAI_API_URL ?? 'https://api.x.ai/v1';
    const model = process.env.XAI_IMAGE_MODEL ?? 'grok-2-image';

    const response = await fetch(`${base}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, prompt, n: 1, response_format: 'b64_json' }),
    });

    const payload = (await response.json()) as XaiImageResponse;
    if (!response.ok) {
      return JSON.stringify({
        ok: false,
        error: payload.error?.message ?? `Image generation failed (${response.status}).`,
      });
    }

    const b64 = payload.data?.[0]?.b64_json;
    if (!b64) return JSON.stringify({ ok: false, error: 'No image was returned.' });

    // Instagram only accepts JPEG for feed images, and only from a public URL.
    const path = `instagram/generated/${Date.now()}.jpg`;
    const { error } = await getSupabase()
      .storage.from(IMAGE_BUCKET)
      .upload(path, Buffer.from(b64, 'base64'), {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) {
      return JSON.stringify({ ok: false, error: `Could not store the image: ${error.message}` });
    }

    const {
      data: { publicUrl },
    } = getSupabase().storage.from(IMAGE_BUCKET).getPublicUrl(path);

    logger.info({ message: 'Generated Instagram image', path });

    return JSON.stringify({
      ok: true,
      imageUrl: publicUrl,
      revisedPrompt: payload.data?.[0]?.revised_prompt ?? prompt,
    });
  },
  {
    name: 'generate_image',
    description:
      'Generates a square Instagram image from a visual description and returns a public ' +
      'URL for it. Describe the composition, subject and mood; the TAMID palette (navy ' +
      '#18274B, sky blue #41B5E8) should be stated in the prompt if it matters. Do not ' +
      'ask for text in the image — generated lettering is unreliable.',
    schema: z.object({
      prompt: z.string().describe('A visual description of the image to generate.'),
    }),
  }
);

/**
 * The chapter's caption rules, as a tool.
 *
 * Deterministic, and the same check that blocks a publish — so the model can
 * fix a caption before a human ever sees it rather than being told after.
 */
export const reviewCaption = tool(
  // Synchronous: the check is pure, so there is nothing to await.
  ({ caption }: { caption: string }) => JSON.stringify(checkCaption(caption)),
  {
    name: 'review_caption',
    description:
      "Checks a draft caption against TAMID's rules: apolitical and areligious framing, " +
      'correct program names (Investment Fund, Consulting, Quant, Israel Fellowship), hook ' +
      'length, hashtag count, emoji use and filler phrasing. Returns blocking issues that ' +
      'must be fixed and warnings worth considering. Always run this before finishing.',
    schema: z.object({ caption: z.string().describe('The draft caption to check.') }),
  }
);

/**
 * What has actually performed on this account.
 *
 * Grounds tone and hashtag choices in the chapter's own results rather than
 * generic social-media advice.
 */
export const topPerformingPosts = tool(
  async ({ limit }: { limit?: number }) => {
    try {
      const insights = await postInsights(limit ?? 8);
      const ranked = insights.posts
        .filter((p) => p.metrics !== null)
        .sort((a, b) => (b.engagementRate ?? 0) - (a.engagementRate ?? 0))
        .slice(0, 5)
        .map((p) => ({
          caption: p.caption.slice(0, 300),
          reach: p.metrics?.reach ?? 0,
          engagementRate: p.engagementRate,
        }));

      return JSON.stringify({ ok: true, medianReach: insights.summary.medianReach, ranked });
    } catch (error) {
      // Analytics being unavailable should not stop a post being written.
      return JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Insights unavailable.',
      });
    }
  },
  {
    name: 'top_performing_posts',
    description:
      "Returns the chapter's recent posts ranked by engagement rate, with their captions. " +
      'Use this to match the voice and hashtag choices of what has actually worked on this ' +
      'account rather than guessing.',
    schema: z.object({
      limit: z.number().int().min(1).max(25).optional().describe('How many posts to consider.'),
    }),
  }
);

/** Real event and board data, so a post never invents a date or a name. */
export const chapterFacts = tool(
  async ({ kind }: { kind: 'events' | 'board' }) => {
    const table = kind === 'events' ? 'events' : 'board_members';
    const { data, error } = await getSupabase().from(table).select('*').limit(20);

    if (error) return JSON.stringify({ ok: false, error: error.message });
    return JSON.stringify({ ok: true, kind, rows: data ?? [] });
  },
  {
    name: 'chapter_facts',
    description:
      'Looks up real TAMID data: upcoming and past events, or current board members. Use ' +
      'this for any date, name, time or location rather than inventing one — a wrong date ' +
      'in a published post cannot be edited.',
    schema: z.object({
      kind: z.enum(['events', 'board']).describe('Which records to look up.'),
    }),
  }
);

export const POST_TOOLS = [generateImage, reviewCaption, topPerformingPosts, chapterFacts];
