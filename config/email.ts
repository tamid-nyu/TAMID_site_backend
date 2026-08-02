import { Resend } from 'resend';
import { logger } from '../logger.js';

let resend: Resend | null = null;

export const isEmailSendingDisabled = (): boolean => {
  return process.env.DISABLE_EMAIL_SENDING === 'true';
};

/**
 * Initialize Resend client
 */
export const initializeEmailTransporter = (): void => {
  if (isEmailSendingDisabled()) {
    logger.info({
      message: 'Email sending disabled via DISABLE_EMAIL_SENDING',
    });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    logger.warn({
      message: 'Resend API key not configured - email sending is disabled',
    });
    return;
  }

  resend = new Resend(apiKey);
  logger.info({ message: 'Resend email client initialized' });
};

/**
 * Check if email sending is available
 */
export const isEmailEnabled = (): boolean => {
  return !isEmailSendingDisabled() && resend !== null;
};

/**
 * Send email
 */
export const sendEmail = async (options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> => {
  if (!resend) {
    logger.warn({ message: 'Attempted to send email but Resend client not initialized' });
    return false;
  }

  const from = 'contact@bot.nyu-tamid.org';

  try {
    const { error } = await resend.emails.send({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    if (error) {
      logger.error({
        message: 'Failed to send email via Resend',
        error: error.message,
        to: options.to,
        subject: options.subject,
      });
      return false;
    }

    logger.info({
      message: 'Email sent successfully',
      to: options.to,
      subject: options.subject,
    });

    return true;
  } catch (error) {
    logger.error({
      message: 'Failed to send email',
      error: error instanceof Error ? error.message : 'Unknown error',
      to: options.to,
      subject: options.subject,
    });
    return false;
  }
};
