import { describeSupabaseError, getSupabase } from '../config/supabase.js';
import { sendEmail, isEmailEnabled, isEmailSendingDisabled } from '../config/email.js';
import type { ContactSubmissionRow } from '../types/index.js';
import { logger } from '../logger.js';

class ContactForm {
  id: string | undefined;
  firstName: string;
  lastName: string;
  email: string;
  company: string | null;
  message: string;
  createdAt: string;

  constructor(data: ContactSubmissionRow) {
    this.id = data.id;
    this.firstName = data.first_name;
    this.lastName = data.last_name;
    this.email = data.email;
    this.company = data.company;
    this.message = data.message;
    this.createdAt = data.created_at;
  }

  // Convert database row to model instance
  static fromDatabase(row: ContactSubmissionRow | null): ContactForm | null {
    if (!row) return null;
    return new ContactForm(row);
  }

  // Convert model instance to database format (snake_case)
  toDatabase(): Omit<ContactSubmissionRow, 'id'> {
    return {
      first_name: this.firstName,
      last_name: this.lastName,
      email: this.email,
      company: this.company,
      message: this.message,
      created_at: this.createdAt,
    };
  }

  // Convert to JSON response format (camelCase)
  static toJSON(row: ContactSubmissionRow) {
    return {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      company: row.company,
      message: row.message,
      createdAt: row.created_at,
    };
  }

  // Validation
  validate(): string[] {
    const errors: string[] = [];

    if (!this.firstName || this.firstName.trim().length === 0) {
      errors.push('First name is required');
    }

    if (!this.lastName || this.lastName.trim().length === 0) {
      errors.push('Last name is required');
    }

    if (!this.email || this.email.trim().length === 0) {
      errors.push('Email is required');
    }

    if (this.email) {
      const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(this.email.toLowerCase())) {
        errors.push('Please enter a valid email');
      }
    }

    if (!this.message || this.message.trim().length === 0) {
      errors.push('Message is required');
    }

    if (this.firstName && this.firstName.length > 100) {
      errors.push('First name cannot exceed 100 characters');
    }

    if (this.lastName && this.lastName.length > 100) {
      errors.push('Last name cannot exceed 100 characters');
    }

    if (this.company && this.company.length > 255) {
      errors.push('Company cannot exceed 255 characters');
    }

    if (this.message && this.message.length > 5000) {
      errors.push('Message cannot exceed 5000 characters');
    }

    return errors;
  }

  static async create(formData: {
    first_name: string;
    last_name: string;
    email: string;
    company: string | null;
    message: string;
  }): Promise<ContactForm | null> {
    // Create a temporary row object for the constructor
    const tempRow: ContactSubmissionRow = {
      id: '',
      first_name: formData.first_name,
      last_name: formData.last_name,
      email: formData.email,
      company: formData.company,
      message: formData.message,
      created_at: new Date().toISOString(),
    };

    const form = new ContactForm(tempRow);

    // Normalize email
    if (form.email) {
      form.email = form.email.toLowerCase().trim();
    }

    // Validate
    const errors = form.validate();
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    const supabase = getSupabase();

    const { error } = await supabase.from('contact_requests').insert(form.toDatabase());

    if (error) {
      throw new Error(`Failed to create contact submission: ${describeSupabaseError(error)}`);
    }

    return form;
  }

  /**
   * Send notification email about a contact form submission
   */
  async sendNotificationEmail(): Promise<boolean> {
    if (isEmailSendingDisabled()) {
      logger.info({ message: 'Email sending disabled - skipping contact notification email' });
      return true;
    }

    if (!isEmailEnabled()) {
      logger.warn({ message: 'Email not configured - skipping notification' });
      return false;
    }

    const recipientEmail = process.env.CONTACT_NOTIFICATION_EMAIL || 'tamid@nyu.edu';

    const subject = `Contact Form Submission from ${this.firstName} ${this.lastName}`;

    const submittedAt = new Date(this.createdAt).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      dateStyle: 'full',
      timeStyle: 'long',
    });

    const text = `
New Contact Form Submission

Name: ${this.firstName} ${this.lastName}
Email: ${this.email}
Company: ${this.company || 'Not provided'}

Message:
${this.message}

---
Submitted at: ${submittedAt}
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .field { margin-bottom: 15px; }
    .label { font-weight: bold; color: #2c3e50; }
    .message { background: white; padding: 15px; border-left: 4px solid #2c3e50; margin-top: 10px; }
    .footer { text-align: center; padding: 10px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New Contact Form Submission</h1>
    </div>
    <div class="content">
      <div class="field">
        <span class="label">Name:</span> ${this.firstName} ${this.lastName}
      </div>
      <div class="field">
        <span class="label">Email:</span> <a href="mailto:${this.email}">${this.email}</a>
      </div>
      <div class="field">
        <span class="label">Company:</span> ${this.company || 'Not provided'}
      </div>
      <div class="field">
        <span class="label">Message:</span>
        <div class="message">${this.message?.replace(/\n/g, '<br>')}</div>
      </div>
    </div>
    <div class="footer">
      Submitted at: ${submittedAt}
    </div>
  </div>
</body>
</html>
    `.trim();

    return sendEmail({
      to: recipientEmail,
      subject,
      text,
      html,
    });
  }
}

export default ContactForm;
