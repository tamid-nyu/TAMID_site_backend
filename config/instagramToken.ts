import { getSupabase } from './supabase.js';
import { logger } from '../logger.js';

/**
 * Instagram access-token storage and renewal.
 *
 * Instagram long-lived tokens expire after 60 days. Left in an environment
 * variable, that means publishing silently stops working two months after setup
 * with nothing to indicate why — so the live token lives in `site_config`, where
 * a scheduled refresh can rotate it without a redeploy.
 *
 * IG_ACCESS_TOKEN remains the seed: it is used when the row does not exist yet,
 * which is also what happens on a fresh environment.
 */

const CONFIG_KEY = 'instagram_access_token';
const REFRESHED_KEY = 'instagram_token_refreshed_at';

/** Tokens must be at least 24 hours old before Instagram will refresh them. */
const MIN_AGE_MS = 25 * 60 * 60 * 1000;

/** Refresh once the token is over halfway through its 60-day life. */
const REFRESH_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

// A warm serverless container reuses this rather than hitting the database on
// every Instagram call.
let cached: { token: string; readAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

const readConfig = async (key: string): Promise<string | null> => {
  const { data, error } = await getSupabase()
    .from('site_config')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (error) {
    logger.warn({ message: 'Could not read site_config', key, error: error.message });
    return null;
  }
  return typeof data?.value === 'string' && data.value !== '' ? data.value : null;
};

const writeConfig = async (key: string, value: string): Promise<void> => {
  const { error } = await getSupabase()
    .from('site_config')
    .upsert({ key, value }, { onConflict: 'key' });

  if (error) throw new Error(`Could not write ${key}: ${error.message}`);
};

/**
 * The token to use for Instagram calls.
 *
 * Prefers the stored token, since that is the one being rotated; falls back to
 * the environment seed.
 */
export const getInstagramToken = async (): Promise<string | undefined> => {
  if (cached && Date.now() - cached.readAt < CACHE_TTL_MS) return cached.token;

  const stored = await readConfig(CONFIG_KEY).catch(() => null);
  const token = stored ?? process.env.IG_ACCESS_TOKEN;
  if (token) cached = { token, readAt: Date.now() };
  return token;
};

/** Forgets the cached token, so the next call re-reads storage. */
export const clearInstagramTokenCache = (): void => {
  cached = null;
};

export interface RefreshOutcome {
  refreshed: boolean;
  reason: string;
  expiresInDays?: number;
}

/**
 * Exchanges the current token for a fresh 60-day one.
 *
 * Instagram refuses to refresh a token less than 24 hours old, and refreshing
 * on every run would be pointless churn, so this is a no-op until the token is
 * past the halfway mark unless `force` is set.
 */
export const refreshInstagramToken = async (force = false): Promise<RefreshOutcome> => {
  const token = await getInstagramToken();
  if (!token) return { refreshed: false, reason: 'No Instagram token is configured.' };

  const lastRefreshed = await readConfig(REFRESHED_KEY).catch(() => null);
  const lastMs = lastRefreshed ? Date.parse(lastRefreshed) : NaN;

  if (!force && Number.isFinite(lastMs)) {
    const age = Date.now() - lastMs;
    if (age < MIN_AGE_MS) {
      return { refreshed: false, reason: 'Token is under 24 hours old; Instagram will refuse.' };
    }
    if (age < REFRESH_AFTER_MS) {
      const days = Math.floor((REFRESH_AFTER_MS - age) / 86_400_000);
      return { refreshed: false, reason: `Still fresh; next refresh due in ~${days} days.` };
    }
  }

  const base = process.env.IG_GRAPH_URL ?? 'https://graph.instagram.com/v21.0';
  const origin = new URL(base).origin;
  const url = new URL(`${origin}/refresh_access_token`);
  url.searchParams.set('grant_type', 'ig_refresh_token');
  url.searchParams.set('access_token', token);

  const response = await fetch(url);
  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error?.message ?? `Refresh failed with status ${response.status}`);
  }

  await writeConfig(CONFIG_KEY, payload.access_token);
  await writeConfig(REFRESHED_KEY, new Date().toISOString());
  clearInstagramTokenCache();

  const expiresInDays = Math.floor((payload.expires_in ?? 0) / 86_400);
  logger.info({ message: 'Instagram token refreshed', expiresInDays });

  return { refreshed: true, reason: 'Token refreshed.', expiresInDays };
};

/** Days until the stored token expires, as far as we can tell from storage. */
export const tokenStatus = async (): Promise<{
  storedInDatabase: boolean;
  lastRefreshed: string | null;
  daysUntilExpiry: number | null;
}> => {
  const stored = await readConfig(CONFIG_KEY).catch(() => null);
  const lastRefreshed = await readConfig(REFRESHED_KEY).catch(() => null);
  const lastMs = lastRefreshed ? Date.parse(lastRefreshed) : NaN;

  return {
    storedInDatabase: stored !== null,
    lastRefreshed,
    daysUntilExpiry: Number.isFinite(lastMs)
      ? Math.floor((lastMs + 60 * 86_400_000 - Date.now()) / 86_400_000)
      : null,
  };
};
