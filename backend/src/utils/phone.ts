import { parsePhoneNumberFromString, CountryCode, getCountries } from 'libphonenumber-js';
import { Metadata, validatePhoneNumberLength } from 'libphonenumber-js/mobile';
import { AppError } from './errors';

export interface ParsedPhone {
  countryCode: string;
  phoneNumber: string;
  fullPhone: string;
  phoneCountry: string;
  iso: CountryCode;
}

const ISO_NAMES: Record<string, string> = {
  IN: 'India',
  US: 'United States',
  CA: 'Canada',
  GB: 'United Kingdom',
  AU: 'Australia',
  DE: 'Germany',
  FR: 'France',
  SG: 'Singapore',
  AE: 'United Arab Emirates',
};

export function getCountryIsoByName(countryName: string): CountryCode | null {
  const normalized = countryName.trim().toLowerCase();
  if (!normalized) return null;

  return getCountries().find((iso) => getCountryName(iso).toLowerCase() === normalized) || null;
}

export function getCountryName(iso: string): string {
  try {
    const display = new Intl.DisplayNames(['en'], { type: 'region' });
    return display.of(iso) || ISO_NAMES[iso] || iso;
  } catch {
    return ISO_NAMES[iso] || iso;
  }
}

export function listSupportedCountries() {
  return getCountries()
    .map((iso) => {
      const parsed = parsePhoneNumberFromString('+1', iso);
      const callingCode = parsed?.countryCallingCode ? `+${parsed.countryCallingCode}` : '';
      return {
        iso,
        name: getCountryName(iso),
        dialCode: callingCode,
        flag: isoToFlag(iso),
      };
    })
    .filter((c) => c.dialCode)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function isoToFlag(iso: string): string {
  return iso
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

export function getExpectedMobilePhoneDigitLabel(countryIso: string): string {
  const metadata = new Metadata();
  metadata.selectNumberingPlan(countryIso.toUpperCase() as CountryCode);
  const plan = metadata.numberingPlan as {
    type?: (phoneType: string) => { possibleLengths?: () => number[] };
  } | undefined;
  const lengths = plan?.type?.('MOBILE')?.possibleLengths?.() || [];

  if (lengths.length === 0) return '';
  if (lengths.length === 1) return String(lengths[0]);
  if (lengths.length === 2) return `${lengths[0]} or ${lengths[1]}`;
  return `${lengths[0]}-${lengths[lengths.length - 1]}`;
}

export function getPhoneValidationErrorMessage(countryIso: string, nationalNumber: string): string | null {
  const digits = nationalNumber.replace(/\D/g, '');
  if (!digits) return 'Phone number is required';

  if (isValidPhoneForCountry(countryIso, digits)) return null;

  const iso = countryIso.toUpperCase() as CountryCode;
  const countryName = getCountryName(iso);
  const expectedDigits = getExpectedMobilePhoneDigitLabel(iso);
  const lengthIssue = validatePhoneNumberLength(digits, iso);

  if (
    expectedDigits &&
    (lengthIssue === 'TOO_SHORT' || lengthIssue === 'TOO_LONG' || lengthIssue === 'INVALID_LENGTH')
  ) {
    return `Please enter ${expectedDigits} digits for ${countryName}.`;
  }

  if (expectedDigits) {
    return `Please enter ${expectedDigits} digits for ${countryName}.`;
  }

  return `Please enter a valid phone number for ${countryName}.`;
}

export function parseAndValidatePhone(
  countryIso: string,
  nationalNumber: string
): ParsedPhone {
  const digits = nationalNumber.replace(/\D/g, '');
  if (!digits) {
    throw new AppError(400, 'Phone number is required');
  }

  const iso = countryIso.toUpperCase() as CountryCode;
  const phone = parsePhoneNumberFromString(digits, iso);

  if (!phone || !phone.isValid()) {
    const message = getPhoneValidationErrorMessage(iso, nationalNumber);
    throw new AppError(400, message || 'Invalid phone number for the selected country');
  }

  return {
    countryCode: `+${phone.countryCallingCode}`,
    phoneNumber: phone.nationalNumber,
    fullPhone: phone.format('E.164'),
    phoneCountry: getCountryName(iso),
    iso,
  };
}

export function parseAndValidatePhoneInput(
  currentCountryIso: string,
  phoneInput: string
): ParsedPhone {
  const trimmed = phoneInput.trim();
  if (!trimmed) {
    throw new AppError(400, 'Phone number is required');
  }

  const internationalPhone = trimmed.startsWith('+')
    ? parsePhoneNumberFromString(trimmed)
    : null;

  if (internationalPhone?.isValid() && internationalPhone.country) {
    const iso = internationalPhone.country;
    return {
      countryCode: `+${internationalPhone.countryCallingCode}`,
      phoneNumber: internationalPhone.nationalNumber,
      fullPhone: internationalPhone.format('E.164'),
      phoneCountry: getCountryName(iso),
      iso,
    };
  }

  return parseAndValidatePhone(currentCountryIso, trimmed);
}

export function isValidPhoneForCountry(countryIso: string, nationalNumber: string): boolean {
  try {
    parseAndValidatePhone(countryIso, nationalNumber);
    return true;
  } catch {
    return false;
  }
}
