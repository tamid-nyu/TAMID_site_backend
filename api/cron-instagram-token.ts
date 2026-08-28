import type { IncomingMessage, ServerResponse } from 'http';
import { refreshInstagramToken } from '../config/instagramToken.js';
import { logger } from '../logger.js';

/**
 * Scheduled Instagram token renewal.
 *
 * Instagram long-lived tokens last 60 days. Without this, publishing stops two
 * months after setup with nothing to indicate why.
 *
 * The job runs unattended, so it authenticates on CRON_SECRET rather than an
 * admin session — Vercel sends that as a bearer token on scheduled invocations.
 * It is a no-op until the token is past the halfway point of its life, so a
 * daily schedule costs one cheap call and the token never silently expires.
 *
 * Typed structurally against Node's http types rather than @vercel/node, which
 * is not a dependency of this project.
 */

type Handler = (
  req: IncomingMessage,
  res: ServerResponse & { status: (code: number) => { json: (body: unknown) => void } }
) => Promise<void>;

const handler: Handler = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    res.status(500).json({ error: 'CRON_SECRET is not configured.' });
    return;
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const outcome = await refreshInstagramToken();
    logger.info({ message: 'Instagram token cron ran', ...outcome });
    res.status(200).json(outcome);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ message: 'Instagram token refresh failed', error: message });
    res.status(500).json({ refreshed: false, error: message });
  }
};

export default handler;
