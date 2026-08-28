import { logger } from '../logger.js';

/**
 * Client for Meta's Instagram Content Publishing API.
 *
 * The access token lives only here, server-side. The admin panel is a static
 * SPA, so it must never hold this credential: it reaches Instagram exclusively
 * through the authenticated /v1/instagram routes.
 */

const GRAPH_BASE = process.env.IG_GRAPH_URL ?? 'https://graph.facebook.com/v21.0';

export class InstagramError extends Error {
  public readonly status: number;
  public readonly details: unknown;

  constructor(message: string, status = 500, details: unknown = undefined) {
    super(message);
    this.name = 'InstagramError';
    this.status = status;
    this.details = details;
  }
}

export const isInstagramConfigured = (): boolean =>
  Boolean(process.env.IG_ACCESS_TOKEN && process.env.IG_USER_ID);

const requireConfig = (): { token: string; userId: string } => {
  const token = process.env.IG_ACCESS_TOKEN;
  const userId = process.env.IG_USER_ID;

  if (!token || !userId) {
    const missing: string[] = [];
    if (!token) missing.push('IG_ACCESS_TOKEN');
    if (!userId) missing.push('IG_USER_ID');
    throw new InstagramError(`Instagram is not configured. Missing: ${missing.join(', ')}.`, 503);
  }

  return { token, userId };
};

export const instagramAccountId = (): string => requireConfig().userId;

const request = async <T>(
  method: 'GET' | 'POST',
  path: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<T> => {
  const { token } = requireConfig();
  const url = new URL(GRAPH_BASE + (path.startsWith('/') ? path : `/${path}`));

  const init: RequestInit = { method };

  if (method === 'GET') {
    const search = new URLSearchParams({ access_token: token });
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        search.set(key, String(value));
      }
    }
    url.search = search.toString();
  } else {
    url.search = new URLSearchParams({ access_token: token }).toString();
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        body.set(key, String(value));
      }
    }
    init.body = body;
  }

  const response = await fetch(url, init);
  const text = await response.text();

  let payload: unknown;
  try {
    payload = text ? (JSON.parse(text) as unknown) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    const graphError = (payload as { error?: { message?: string } })?.error;
    const message =
      graphError?.message ?? `Instagram request failed with status ${response.status}`;

    // The access token must never reach the logs.
    logger.warn({
      message: 'Instagram Graph API request failed',
      path,
      status: response.status,
      graphMessage: graphError?.message,
    });

    throw new InstagramError(message, response.status, payload);
  }

  return payload as T;
};

export const instagram = {
  get: <T>(path: string, params?: Record<string, string | number | boolean | undefined>) =>
    request<T>('GET', path, params),
  post: <T>(path: string, params?: Record<string, string | number | boolean | undefined>) =>
    request<T>('POST', path, params),
};
