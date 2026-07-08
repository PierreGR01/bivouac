import { PoiLocation } from '../types';

export const DISABLE_DURATIONS = [
  { months: 1, label: '1 mois' },
  { months: 3, label: '3 mois' },
  { months: 6, label: '6 mois' },
  { months: 12, label: '12 mois' },
] as const;

export function computeDisabledUntil(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
}

export function isSpotDisabled(location: PoiLocation): boolean {
  return !!location.disabledUntil && new Date(location.disabledUntil).getTime() > Date.now();
}

export function formatRemainingDisableTime(disabledUntil: string): string {
  const diffMs = new Date(disabledUntil).getTime() - Date.now();
  const days = Math.ceil(diffMs / 86_400_000);
  if (days <= 0) return 'quelques instants';
  if (days < 60) return `${days} jour${days > 1 ? 's' : ''}`;
  const months = Math.round(days / 30);
  return `${months} mois`;
}
