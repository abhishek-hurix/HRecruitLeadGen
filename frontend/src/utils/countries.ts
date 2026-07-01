import { getCountries, parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';
import { Metadata, validatePhoneNumberLength } from 'libphonenumber-js/mobile';

export interface CountryOption {
  iso: CountryCode;
  name: string;
  dialCode: string;
  flag: string;
}

function getCountryName(iso: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(iso) || iso;
  } catch {
    return iso;
  }
}

export function isoToFlag(iso: string): string {
  return iso
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

export function buildCountryList(): CountryOption[] {
  return getCountries()
    .map((iso) => {
      const sample = parsePhoneNumberFromString('1234567', iso);
      const dialCode = sample?.countryCallingCode ? `+${sample.countryCallingCode}` : '';
      return {
        iso,
        name: getCountryName(iso),
        dialCode,
        flag: isoToFlag(iso),
      };
    })
    .filter((c) => c.dialCode)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getCountryNameFromDialCode(dialCode: string): string | null {
  const normalizedDialCode = dialCode.trim();
  if (!normalizedDialCode) return null;

  return buildCountryList().find((country) => country.dialCode === normalizedDialCode)?.name || null;
}

export const DEFAULT_COUNTRY_ISO: CountryCode = 'IN';

export function isValidNationalPhone(iso: CountryCode, nationalNumber: string): boolean {
  const digits = nationalNumber.replace(/\D/g, '');
  if (!digits) return false;
  const phone = parsePhoneNumberFromString(digits, iso);
  return Boolean(phone?.isValid());
}

export function formatFullPhone(iso: CountryCode, nationalNumber: string): string | null {
  const digits = nationalNumber.replace(/\D/g, '');
  const phone = parsePhoneNumberFromString(digits, iso);
  return phone?.isValid() ? phone.format('E.164') : null;
}

export function getCountryIsoFromProfile(countryCode: string, phoneCountry: string): CountryCode {
  const countries = buildCountryList();
  const byName = countries.find((country) => country.name === phoneCountry);
  if (byName) return byName.iso;

  const normalizedDialCode = countryCode.trim();
  const byDialCode = countries.find((country) => country.dialCode === normalizedDialCode);
  if (byDialCode) return byDialCode.iso;

  return DEFAULT_COUNTRY_ISO;
}

export function getExpectedMobilePhoneDigitLabel(iso: CountryCode): string {
  const metadata = new Metadata();
  metadata.selectNumberingPlan(iso);
  const plan = metadata.numberingPlan as {
    type?: (phoneType: string) => { possibleLengths?: () => number[] };
  } | undefined;
  const lengths = plan?.type?.('MOBILE')?.possibleLengths?.() || [];

  if (lengths.length === 0) return '';
  if (lengths.length === 1) return String(lengths[0]);
  if (lengths.length === 2) return `${lengths[0]} or ${lengths[1]}`;
  return `${lengths[0]}-${lengths[lengths.length - 1]}`;
}

export function getPhoneSaveValidationError(iso: CountryCode, nationalNumber: string): string | null {
  const digits = nationalNumber.replace(/\D/g, '');
  if (!digits) return 'Phone number is required';

  if (isValidNationalPhone(iso, digits)) return null;

  const countryName = buildCountryList().find((country) => country.iso === iso)?.name || iso;
  const expectedDigits = getExpectedMobilePhoneDigitLabel(iso);
  const lengthIssue = validatePhoneNumberLength(digits, iso);

  if (expectedDigits && (lengthIssue === 'TOO_SHORT' || lengthIssue === 'TOO_LONG' || lengthIssue === 'INVALID_LENGTH')) {
    return `Please enter ${expectedDigits} digits for ${countryName}.`;
  }

  if (expectedDigits) {
    return `Please enter ${expectedDigits} digits for ${countryName}.`;
  }

  return `Please enter a valid phone number for ${countryName}.`;
}

export function splitProfilePhone(
  fullPhone: string,
  phoneNumber: string,
  countryCode: string,
  phoneCountry: string
): { iso: CountryCode; nationalNumber: string } {
  const parsed = parsePhoneNumberFromString(fullPhone);
  if (parsed?.country && parsed.nationalNumber) {
    return { iso: parsed.country, nationalNumber: parsed.nationalNumber };
  }

  const iso = getCountryIsoFromProfile(countryCode, phoneCountry);
  const digits = (phoneNumber || fullPhone).replace(/\D/g, '');
  return { iso, nationalNumber: digits };
}
