import { instagram, instagramAccountId } from './instagram.js';

/**
 * Instagram insights.
 *
 * Metric names are pinned to the ones verified against this account rather than
 * accepted from callers. Meta retired several older names (`impressions` became
 * `views`), and a single retired metric fails the entire request rather than
 * degrading — so a fixed list fails loudly here instead of silently in the UI.
 *
 * Everything below returns a fixed shape. The Graph API is inconsistent about
 * this: a metric covering a single point comes back as a bare value rather than
 * a series, absent metrics are omitted entirely, and per-post metrics vary by
 * media type. Normalising here means a client never has to guess whether a
 * field is a number, an array, or missing.
 */

// One value per day, requested with period=day.
const TIME_SERIES = ['reach', 'follower_count'] as const;

// Totals over the window; these require metric_type=total_value and cannot be
// combined with the time-series metrics in one request.
const TOTALS = [
  'views',
  'profile_views',
  'website_clicks',
  'accounts_engaged',
  'total_interactions',
] as const;

const MEDIA_METRICS = [
  'reach',
  'views',
  'likes',
  'comments',
  'saved',
  'shares',
  'total_interactions',
] as const;

interface InsightValue {
  value?: number;
  end_time?: string;
}

interface BreakdownResult {
  dimension_values?: string[];
  value?: number;
}

interface InsightMetric {
  name?: string;
  values?: InsightValue[];
  total_value?: { value?: number; breakdowns?: Array<{ results?: BreakdownResult[] }> };
}

export interface DailyPoint {
  date: string;
  value: number;
}

export interface AccountTotals {
  views: number;
  profileViews: number;
  websiteClicks: number;
  accountsEngaged: number;
  totalInteractions: number;
}

export interface AccountInsights {
  windowDays: number;
  totals: AccountTotals;
  daily: { reach: DailyPoint[]; followerCount: DailyPoint[] };
  followersGained: number;
}

export interface PostMetrics {
  reach: number;
  views: number;
  likes: number;
  comments: number;
  saved: number;
  shares: number;
  totalInteractions: number;
}

export interface PostInsight {
  id: string;
  posted: string | null;
  type: string | null;
  permalink: string | null;
  caption: string;
  thumbnail: string | null;
  metrics: PostMetrics | null;
  engagementRate: number | null;
  insightsError: string | null;
}

export interface PostInsights {
  summary: { postsMeasured: number; medianReach: number; medianViews: number };
  posts: PostInsight[];
}

export interface AudienceInsights {
  breakdown: string;
  rows: Array<{ value: string; followers: number }>;
  totalFollowers: number;
}

const windowFor = (days: number) => {
  const now = Math.floor(Date.now() / 1000);
  return { since: now - days * 86400, until: now };
};

const asNumber = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

/** Index a response by metric name, tolerating omitted or unnamed metrics. */
const byName = (response: { data?: InsightMetric[] }): Map<string, InsightMetric> => {
  const map = new Map<string, InsightMetric>();
  for (const metric of response.data ?? []) {
    if (metric.name) map.set(metric.name, metric);
  }
  return map;
};

/** A total_value metric, or 0 when the metric was not returned at all. */
const totalOf = (metrics: Map<string, InsightMetric>, name: string): number =>
  asNumber(metrics.get(name)?.total_value?.value);

/**
 * A time series, always as an array.
 *
 * The API returns a bare value rather than a series when a window covers a
 * single point, so a one-day request would otherwise change the field's type.
 */
const seriesOf = (metrics: Map<string, InsightMetric>, name: string): DailyPoint[] =>
  (metrics.get(name)?.values ?? [])
    .filter((v): v is InsightValue & { end_time: string } => typeof v.end_time === 'string')
    .map((v) => ({ date: v.end_time, value: asNumber(v.value) }));

const median = (nums: number[]): number => {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

export const accountInsights = async (days: number): Promise<AccountInsights> => {
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

  const t = byName(totals);
  const s = byName(series);
  const followerCount = seriesOf(s, 'follower_count');

  return {
    windowDays: days,
    totals: {
      views: totalOf(t, 'views'),
      profileViews: totalOf(t, 'profile_views'),
      websiteClicks: totalOf(t, 'website_clicks'),
      accountsEngaged: totalOf(t, 'accounts_engaged'),
      totalInteractions: totalOf(t, 'total_interactions'),
    },
    daily: { reach: seriesOf(s, 'reach'), followerCount },
    // follower_count is a daily delta, so the sum is the net change across the
    // window rather than a running total.
    followersGained: followerCount.reduce((sum, p) => sum + p.value, 0),
  };
};

export const postInsights = async (limit: number): Promise<PostInsights> => {
  const id = instagramAccountId();
  const media = await instagram.get<{
    data?: Array<{
      id?: string;
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

  const posts: PostInsight[] = await Promise.all(
    (media.data ?? [])
      .filter((post): post is typeof post & { id: string } => typeof post.id === 'string')
      .map(async (post) => {
        const base = {
          id: post.id,
          posted: post.timestamp ?? null,
          type: post.media_type ?? null,
          permalink: post.permalink ?? null,
          caption: post.caption ?? '',
          // Prefer the video still; fall back to the image itself.
          thumbnail: post.thumbnail_url ?? post.media_url ?? null,
        };

        try {
          const response = await instagram.get<{ data?: InsightMetric[] }>(`/${post.id}/insights`, {
            metric: MEDIA_METRICS.join(','),
          });
          const m = byName(response);
          // Media insights arrive as a single value; newer metrics use
          // total_value. Accept either rather than assuming one.
          const value = (name: string) =>
            asNumber(m.get(name)?.total_value?.value ?? m.get(name)?.values?.[0]?.value);

          const metrics: PostMetrics = {
            reach: value('reach'),
            views: value('views'),
            likes: value('likes'),
            comments: value('comments'),
            saved: value('saved'),
            shares: value('shares'),
            totalInteractions: value('total_interactions'),
          };

          return {
            ...base,
            metrics,
            engagementRate:
              metrics.reach > 0
                ? Number(((metrics.totalInteractions / metrics.reach) * 100).toFixed(2))
                : null,
            insightsError: null,
          };
        } catch (error) {
          // Older posts and some media types have no insights. Report it on the
          // row rather than failing the whole batch.
          return {
            ...base,
            metrics: null,
            engagementRate: null,
            insightsError: error instanceof Error ? error.message : 'Unavailable',
          };
        }
      })
  );

  const measured = posts.flatMap((p) => (p.metrics ? [p.metrics] : []));

  return {
    summary: {
      postsMeasured: measured.length,
      medianReach: median(measured.map((m) => m.reach)),
      medianViews: median(measured.map((m) => m.views)),
    },
    posts,
  };
};

export const audienceInsights = async (breakdown: string): Promise<AudienceInsights> => {
  const id = instagramAccountId();
  const res = await instagram.get<{ data?: InsightMetric[] }>(`/${id}/insights`, {
    metric: 'follower_demographics',
    period: 'lifetime',
    metric_type: 'total_value',
    breakdown,
  });

  const results = res.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
  const rows = results
    .map((r) => ({
      value: r.dimension_values?.[0] ?? 'Unknown',
      followers: asNumber(r.value),
    }))
    .sort((a, b) => b.followers - a.followers);

  return {
    breakdown,
    rows,
    totalFollowers: rows.reduce((sum, r) => sum + r.followers, 0),
  };
};
