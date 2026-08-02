import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createSupabaseQueryMock } from '../test/helpers/supabase.js';

describe('ContactForm model', () => {
  const sendEmail = jest.fn<(payload: unknown) => Promise<boolean>>();
  const insertQuery = createSupabaseQueryMock({ error: null });

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.DISABLE_EMAIL_SENDING = 'true';
    jest.unstable_mockModule('../logger.js', () => ({
      logger: {
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
      },
    }));
    jest.unstable_mockModule('../config/supabase.js', () => ({
      describeSupabaseError: (error: unknown) => String(error),
      getSupabase: jest.fn(() => ({
        from: jest.fn(() => insertQuery),
      })),
    }));
    jest.unstable_mockModule('../config/email.js', () => ({
      isEmailEnabled: jest.fn(() => true),
      isEmailSendingDisabled: jest.fn(() => process.env.DISABLE_EMAIL_SENDING === 'true'),
      sendEmail,
    }));
  });

  it('validates required fields and length limits', async () => {
    const { default: ContactForm } = await import('./ContactForm.js');
    const form = new ContactForm({
      id: 'contact-id',
      first_name: '',
      last_name: '',
      email: 'not-email',
      company: 'x'.repeat(256),
      message: '',
      created_at: '2026-01-01T00:00:00.000Z',
    });

    expect(form.validate()).toEqual(
      expect.arrayContaining([
        'First name is required',
        'Last name is required',
        'Please enter a valid email',
        'Company cannot exceed 255 characters',
        'Message is required',
      ])
    );
  });

  it('normalizes email and inserts contact requests', async () => {
    const { default: ContactForm } = await import('./ContactForm.js');

    const form = await ContactForm.create({
      first_name: 'John',
      last_name: 'Doe',
      email: ' JDOE@stern.nyu.edu ',
      company: null,
      message: 'Hello',
    });

    expect(form?.email).toBe('jdoe@stern.nyu.edu');
    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: 'John',
        last_name: 'Doe',
        email: 'jdoe@stern.nyu.edu',
        company: null,
        message: 'Hello',
      })
    );
  });

  it('skips notification email when sending is disabled', async () => {
    const { default: ContactForm } = await import('./ContactForm.js');
    const form = new ContactForm({
      id: 'contact-id',
      first_name: 'John',
      last_name: 'Doe',
      email: 'jdoe@stern.nyu.edu',
      company: null,
      message: 'Hello',
      created_at: '2026-01-01T00:00:00.000Z',
    });

    await expect(form.sendNotificationEmail()).resolves.toBe(true);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('sends configured contact notification email when enabled', async () => {
    process.env.DISABLE_EMAIL_SENDING = 'false';
    process.env.CONTACT_NOTIFICATION_EMAIL = 'team@example.com';
    sendEmail.mockResolvedValue(true);
    const { default: ContactForm } = await import('./ContactForm.js');
    const form = new ContactForm({
      id: 'contact-id',
      first_name: 'John',
      last_name: 'Doe',
      email: 'jdoe@stern.nyu.edu',
      company: 'NYU',
      message: 'Hello',
      created_at: '2026-01-01T00:00:00.000Z',
    });

    await expect(form.sendNotificationEmail()).resolves.toBe(true);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'team@example.com',
        subject: 'Contact Form Submission from John Doe',
        text: expect.stringContaining('Name: John Doe'),
        html: expect.stringContaining('Hello'),
      })
    );
    delete process.env.CONTACT_NOTIFICATION_EMAIL;
  });
});
