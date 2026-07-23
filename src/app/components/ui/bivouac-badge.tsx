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

interface StatBadgeProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  variant?: 'blue' | 'emerald' | 'orange' | 'gray';
  className?: string;
}

const statBadgeClasses: Record<NonNullable<StatBadgeProps['variant']>, string> = {
  blue: 'bg-blue-50 text-blue-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  orange: 'bg-orange-50 text-orange-700',
  gray: 'bg-gray-50 text-gray-700',
};

// Badge compact tenant sur une seule ligne (icône + libellé + valeur) — remplace les
// anciennes InfoCard trop hautes (label puis gros chiffre sur deux lignes) pour l'outil
// trace et le panneau Filtres, qui affichent tous deux les mêmes statistiques.
export function StatBadge({ icon, label, value, variant = 'gray', className }: StatBadgeProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium overflow-hidden',
        statBadgeClasses[variant],
        className
      )}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
      <span className="ml-auto font-bold flex-shrink-0 pl-1">{value}</span>
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
