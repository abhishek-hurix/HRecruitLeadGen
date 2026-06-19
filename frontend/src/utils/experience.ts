export const EXPERIENCE_OPTIONS = [
  { value: 'FRESHER', label: 'Fresher (0 Years)' },
  { value: 'ZERO_ONE', label: '0-1 Years' },
  { value: 'ONE_TWO', label: '1-2 Years' },
  { value: 'TWO_THREE', label: '2-3 Years' },
  { value: 'THREE_FIVE', label: '3-5 Years' },
  { value: 'FIVE_SEVEN', label: '5-7 Years' },
  { value: 'SEVEN_TEN', label: '7-10 Years' },
  { value: 'TEN_PLUS', label: '10+ Years' },
] as const;

export type ExperienceCategoryValue = (typeof EXPERIENCE_OPTIONS)[number]['value'];

export function getExperienceLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return EXPERIENCE_OPTIONS.find((o) => o.value === value)?.label ?? value.replace(/_/g, ' ');
}
