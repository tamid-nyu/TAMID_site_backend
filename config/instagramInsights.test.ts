import { beforeEach, describe, expect, it, jest } from '@jest/globals';

/**
 * These lock the normalisation contract rather than the Graph API itself.
 *
 * The API is inconsistent — a single-point window returns a bare value instead
 * of a series, absent metrics are omitted entirely, and per-post metrics differ
 * by media type. The point of the module under test is that callers never see
 * that inconsistency, so the cases below feed it the awkward shapes.
 */

const get = jest.fn<(path: string, params?: unknown) => Promise<unknown>>();

jest.unstable_mockModule('./instagram.js', () => ({
  instagram: { get, post: jest.fn() },
  instagramAccountId: () => '17841400000000000',
  isInstagramConfigured: () => true,
  InstagramError: class extends Error {},
}));

const { accountInsights, postInsights, audienceInsights } = await import('./instagramInsights.js');

beforeEach(() => {
  get.mockReset();
});

describe('accountInsights', () => {
  it('returns every total as a number even when metrics are missing', async () => {
    get.mockImplementation((_path: string, params) => {
      const metric = String((params as { metric?: string })?.metric ?? '');
      if (metric.includes('follower_count')) return Promise.resolve({ data: [] });
      // Only one of the five totals came back.
      return Promise.resolve({ data: [{ name: 'views', total_value: { value: 42 } }] });
    });

    const result = await accountInsights(28);

    expect(result.totals).toEqual({
      views: 42,
      profileViews: 0,
      websiteClicks: 0,
      accountsEngaged: 0,
      totalInteractions: 0,
    });
    expect(Object.values(result.totals).every((v) => typeof v === 'number')).toBe(true);
  });

  it('always returns daily series as arrays', async () => {
    get.mockImplementation((_path: string, params) => {
      const metric = String((params as { metric?: string })?.metric ?? '');
      if (metric.includes('follower_count')) {
        return Promise.resolve({
          data: [
            { name: 'reach', values: [{ end_time: '2026-08-01T07:00:00+0000', value: 10 }] },
            {
              name: 'follower_count',
              values: [
                { end_time: '2026-08-01T07:00:00+0000', value: 3 },
                { end_time: '2026-08-02T07:00:00+0000', value: 4 },
              ],
            },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    });

    const result = await accountInsights(2);

    expect(Array.isArray(result.daily.reach)).toBe(true);
    expect(Array.isArray(result.daily.followerCount)).toBe(true);
    expect(result.daily.reach).toHaveLength(1);
    // follower_count is a daily delta, so the window total is the sum.
    expect(result.followersGained).toBe(7);
  });

  it('returns empty arrays rather than undefined when nothing is reported', async () => {
    get.mockResolvedValue({ data: [] });

    const result = await accountInsights(7);

    expect(result.daily.reach).toEqual([]);
    expect(result.daily.followerCount).toEqual([]);
    expect(result.followersGained).toBe(0);
  });

  it('drops data points that carry no timestamp', async () => {
    get.mockImplementation((_path: string, params) => {
      const metric = String((params as { metric?: string })?.metric ?? '');
      if (metric.includes('follower_count')) {
        return Promise.resolve({
          data: [{ name: 'reach', values: [{ value: 5 }, { end_time: 'x', value: 6 }] }],
        });
      }
      return Promise.resolve({ data: [] });
    });

    const result = await accountInsights(7);

    expect(result.daily.reach).toEqual([{ date: 'x', value: 6 }]);
  });
});

describe('postInsights', () => {
  const media = {
    data: [
      {
        id: 'p1',
        caption: 'hello',
        media_type: 'IMAGE',
        permalink: 'https://example.com/p1',
        timestamp: '2026-08-01T00:00:00+0000',
        media_url: 'https://cdn/p1.jpg',
      },
    ],
  };

  it('nests metrics in an object and computes an engagement rate', async () => {
    get.mockImplementation((path: string) => {
      if (path.endsWith('/media')) return Promise.resolve(media);
      return Promise.resolve({
        data: [
          { name: 'reach', values: [{ value: 200 }] },
          { name: 'total_interactions', values: [{ value: 50 }] },
        ],
      });
    });

    const result = await postInsights(1);
    const post = result.posts[0];

    expect(post.metrics).not.toBeNull();
    expect(post.metrics?.reach).toBe(200);
    // Metrics the API omitted still exist as zeroes.
    expect(post.metrics?.likes).toBe(0);
    expect(post.engagementRate).toBe(25);
    expect(post.insightsError).toBeNull();
  });

  it('reports a post whose insights fail without failing the batch', async () => {
    get.mockImplementation((path: string) => {
      if (path.endsWith('/media')) return Promise.resolve(media);
      return Promise.reject(new Error('Unsupported media type'));
    });

    const result = await postInsights(1);

    expect(result.posts).toHaveLength(1);
    expect(result.posts[0].metrics).toBeNull();
    expect(result.posts[0].insightsError).toBe('Unsupported media type');
    expect(result.summary.postsMeasured).toBe(0);
  });

  it('prefers the video still over the video file for a thumbnail', async () => {
    get.mockImplementation((path: string) => {
      if (path.endsWith('/media'))
        return Promise.resolve({
          data: [
            {
              id: 'v1',
              media_type: 'VIDEO',
              media_url: 'https://cdn/v1.mp4',
              thumbnail_url: 'https://cdn/v1.jpg',
            },
          ],
        });
      return Promise.resolve({ data: [] });
    });

    const result = await postInsights(1);

    expect(result.posts[0].thumbnail).toBe('https://cdn/v1.jpg');
  });

  it('nulls optional fields rather than leaving them undefined', async () => {
    get.mockImplementation((path: string) => {
      if (path.endsWith('/media')) return Promise.resolve({ data: [{ id: 'bare' }] });
      return Promise.resolve({ data: [] });
    });

    const post = (await postInsights(1)).posts[0];

    expect(post.posted).toBeNull();
    expect(post.type).toBeNull();
    expect(post.permalink).toBeNull();
    expect(post.thumbnail).toBeNull();
    expect(post.caption).toBe('');
  });

  it('summarises only measured posts', async () => {
    get.mockImplementation((path: string) => {
      if (path.endsWith('/media'))
        return Promise.resolve({ data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] });
      return Promise.resolve({
        data: [
          { name: 'reach', values: [{ value: 100 }] },
          { name: 'views', values: [{ value: 300 }] },
        ],
      });
    });

    const result = await postInsights(3);

    expect(result.summary.postsMeasured).toBe(3);
    expect(result.summary.medianReach).toBe(100);
    expect(result.summary.medianViews).toBe(300);
  });
});

describe('audienceInsights', () => {
  it('sorts rows by followers and totals them', async () => {
    get.mockResolvedValue({
      data: [
        {
          name: 'follower_demographics',
          total_value: {
            breakdowns: [
              {
                results: [
                  { dimension_values: ['Boston'], value: 5 },
                  { dimension_values: ['New York'], value: 50 },
                ],
              },
            ],
          },
        },
      ],
    });

    const result = await audienceInsights('city');

    expect(result.rows[0]).toEqual({ value: 'New York', followers: 50 });
    expect(result.totalFollowers).toBe(55);
  });

  it('returns an empty result rather than throwing when Meta reports nothing', async () => {
    get.mockResolvedValue({ data: [] });

    const result = await audienceInsights('country');

    expect(result.rows).toEqual([]);
    expect(result.totalFollowers).toBe(0);
  });
});
