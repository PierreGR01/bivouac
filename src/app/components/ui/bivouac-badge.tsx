import React from 'react';
import { cn } from './utils';

export type Season = 'printemps' | 'été' | 'hiver' | 'toute saison';

interface SeasonBadgeProps {
  season: Season;
  icon?: React.ReactNode;
  className?: string;
}

const seasonClasses: Record<Season, string> = {
  'printemps': 'bg-emerald-100 text-emerald-800',
  'été': 'bg-orange-100 text-orange-800',
  'hiver': 'bg-slate-100 text-slate-800',
  'toute saison': 'bg-gray-100 text-gray-800',
};

export function SeasonBadge({ season, icon, className }: SeasonBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full',
        seasonClasses[season],
        className
      )}
    >
      {icon}
      {season.charAt(0).toUpperCase() + season.slice(1)}
    </span>
  );
}

interface CountBadgeProps {
  count: number;
  className?: string;
}

export function CountBadge({ count, className }: CountBadgeProps) {
  return (
    <div
      className={cn(
        'bg-emerald-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-md',
        className
      )}
    >
      {count}
    </div>
  );
}

interface StatusBadgeProps {
  status: 'success' | 'warning' | 'error' | 'info';
  children: React.ReactNode;
  className?: string;
}

const statusClasses = {
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
};

export function StatusBadge({ status, children, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full',
        statusClasses[status],
        className
      )}
    >
      {children}
    </span>
  );
}
