import { getCountries, parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

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
