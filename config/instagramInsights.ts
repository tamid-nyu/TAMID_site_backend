import { instagram, instagramAccountId } from './instagram.js';

/**
 * Instagram insights.
 *
 * Metric names are pinned to the ones verified against this account rather than
 * accepted from callers. Meta retired several older names (`impressions` became
 * `views`), and a single retired metric fails the entire request rather than
 * degrading — so a fixed list fails loudly here instead of silently in the UI.
 */

// One value per day, requested with period=day.
const TIME_SERIES = ['reach', 'follower_count'];

// Totals over the window; these require metric_type=total_value and cannot be
// combined with the time-series metrics in one request.
const TOTALS = [
  'views',
  'profile_views',
  'website_clicks',
  'accounts_engaged',
  'total_interactions',
];

const MEDIA_METRICS = [
  'reach',
  'views',
  'likes',
  'comments',
  'saved',
  'shares',
  'total_interactions',
];

interface InsightValue {
  value: number;
  end_time?: string;
}

interface InsightMetric {
  name: string;
  values?: InsightValue[];
  total_value?: { value?: number; breakdowns?: Array<{ results?: BreakdownResult[] }> };
}

interface BreakdownResult {
  dimension_values?: string[];
  value: number;
}

export interface DailyPoint {
  date: string;
  value: number;
}

const windowFor = (days: number) => {
  const now = Math.floor(Date.now() / 1000);
  return { since: now - days * 86400, until: now };
};

const flatten = (response: { data?: InsightMetric[] }): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const metric of response.data ?? []) {
    const values = metric.values ?? [];
    if (metric.total_value !== undefined) {
      out[metric.name] = metric.total_value.value ?? 0;
    } else if (values.length === 1) {
      out[metric.name] = values[0].value;
    } else {
      out[metric.name] = values.map((v) => ({ date: v.end_time ?? '', value: v.value }));
    }
  }
  return out;
};

const median = (nums: number[]): number => {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

export const accountInsights = async (days: number) => {
  const { since, until } = windowFor(days);
  const id = instagramAccountId();

  const [series, totals] = await Promise.all([
    instagram.get<{ data?: InsightMetric[] }>(`/${id}/insights`, {
      metric: TIME_SERIES.join(','),
      period: 'day',
      since,
      until,
    }),
    instagram.get<{ data?: InsightMetric[] }>(`/${id}/insights`, {
      metric: TOTALS.join(','),
      period: 'day',
      metric_type: 'total_value',
      since,
      until,
    }),
  ]);

  return { windowDays: days, totals: flatten(totals), daily: flatten(series) };
};

export const postInsights = async (limit: number) => {
  const id = instagramAccountId();
  const media = await instagram.get<{
    data?: Array<{
      id: string;
      caption?: string;
      media_type?: string;
      permalink?: string;
      timestamp?: string;
      media_url?: string;
      thumbnail_url?: string;
    }>;
  }>(`/${id}/media`, {
    // thumbnail_url is the still for videos and reels; media_url is the asset
    // itself, which for a VIDEO is the video file rather than an image.
    fields: 'id,caption,media_type,permalink,timestamp,media_url,thumbnail_url',
    limit,
  });

  const posts = await Promise.all(
    (media.data ?? []).map(async (post) => {
      const base = {
        id: post.id,
        posted: post.timestamp,
        type: post.media_type,
        permalink: post.permalink,
        caption: post.caption ?? '',
        // Prefer the video still; fall back to the image itself.
        thumbnail: post.thumbnail_url ?? post.media_url,
      };
      try {
        const insights = await instagram.get<{ data?: InsightMetric[] }>(`/${post.id}/insights`, {
          metric: MEDIA_METRICS.join(','),
        });
        const flat = flatten(insights) as Record<string, number>;
        const reach = flat.reach ?? 0;
        const engagementRate =
          reach > 0 ? Number(((flat.total_interactions / reach) * 100).toFixed(2)) : null;
        return { ...base, ...flat, engagementRate };
      } catch (error) {
        // Older posts and some media types have no insights. Report it on the
        // row rather than failing the whole batch.
        return {
          ...base,
          insightsError: error instanceof Error ? error.message : 'Unavailable',
        };
      }
    })
  );

  // Posts whose insights failed carry no metrics, so summarise only the ones
  // that returned numbers.
  const measured = posts.flatMap((p) => {
    const row = p as Record<string, unknown>;
    return typeof row.reach === 'number'
      ? [{ reach: row.reach, views: typeof row.views === 'number' ? row.views : 0 }]
      : [];
  });

  return {
    summary: {
      postsMeasured: measured.length,
      medianReach: median(measured.map((p) => p.reach)),
      medianViews: median(measured.map((p) => p.views)),
    },
    posts,
  };
};

export const audienceInsights = async (breakdown: string) => {
  const id = instagramAccountId();
  const res = await instagram.get<{ data?: InsightMetric[] }>(`/${id}/insights`, {
    metric: 'follower_demographics',
    period: 'lifetime',
    metric_type: 'total_value',
    breakdown,
  });

  const results = res.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
  const rows = results
    .map((r) => ({ value: r.dimension_values?.[0] ?? 'Unknown', followers: r.value }))
    .sort((a, b) => b.followers - a.followers);

  return { breakdown, rows };
};
