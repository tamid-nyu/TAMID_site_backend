import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const resendSend = jest.fn<(payload: unknown) => Promise<{ error: { message: string } | null }>>();
const resendConstructor = jest.fn((apiKey: string) => ({
  emails: {
    send: resendSend,
  },
  apiKey,
}));

jest.unstable_mockModule('resend', () => ({
  Resend: resendConstructor,
}));

jest.unstable_mockModule('../logger.js', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('email config', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.RESEND_API_KEY;
    process.env.DISABLE_EMAIL_SENDING = 'false';
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    process.env.DISABLE_EMAIL_SENDING = 'true';
  });

  it('does not initialize Resend when email sending is disabled', async () => {
    process.env.DISABLE_EMAIL_SENDING = 'true';
    const { initializeEmailTransporter, isEmailEnabled, sendEmail } = await import('./email.js');

    initializeEmailTransporter();

    expect(resendConstructor).not.toHaveBeenCalled();
    expect(isEmailEnabled()).toBe(false);
    await expect(
      sendEmail({
        to: 'team@example.com',
        subject: 'Subject',
        text: 'Body',
      })
    ).resolves.toBe(false);
  });

  it('sends email through Resend when configured', async () => {
    process.env.RESEND_API_KEY = 'resend-test-key';
    resendSend.mockResolvedValue({ error: null });
    const { initializeEmailTransporter, isEmailEnabled, sendEmail } = await import('./email.js');

    initializeEmailTransporter();
    const result = await sendEmail({
      to: 'team@example.com',
      subject: 'Subject',
      text: 'Body',
      html: '<p>Body</p>',
    });

    expect(isEmailEnabled()).toBe(true);
    expect(result).toBe(true);
    expect(resendConstructor).toHaveBeenCalledWith('resend-test-key');
    expect(resendSend).toHaveBeenCalledWith({
      from: 'contact@bot.nyu-tamid.org',
      to: 'team@example.com',
      subject: 'Subject',
      text: 'Body',
      html: '<p>Body</p>',
    });
  });

  it('returns false when Resend reports an error', async () => {
    process.env.RESEND_API_KEY = 'resend-test-key';
    resendSend.mockResolvedValue({ error: { message: 'denied' } });
    const { initializeEmailTransporter, sendEmail } = await import('./email.js');

    initializeEmailTransporter();

    await expect(
      sendEmail({
        to: 'team@example.com',
        subject: 'Subject',
        text: 'Body',
      })
    ).resolves.toBe(false);
  });
});
