export interface EmailDraft {
  to: string;
  subject: string;
  body: string;
}

export interface EmailSender {
  createDraft(message: EmailDraft): string;
}

export const mailtoEmailSender: EmailSender = {
  createDraft: ({ to, subject, body }) => `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
};

export function isValidEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim());
}
