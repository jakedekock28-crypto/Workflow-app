import { parsePhoneNumberFromString } from 'libphonenumber-js';

export function formatAustralianPhone(input: string): string | null {
  const cleaned = input.trim().replace(/[\s().-]/g, '');
  if (!cleaned) return null;
  const phone = parsePhoneNumberFromString(cleaned, 'AU');
  if (!phone?.isValid() || phone.country !== 'AU') return null;
  return phone.number;
}

export function isValidEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim());
}
