import React from 'react';
import { Droplets, Snowflake, SunSnow, Waves, Tent, Mountain } from 'lucide-react';
import { Panel } from './ui/bivouac-panel';

export interface FilterOptions {
  seasons: string[];       // 'toute-saison' | 'hiver'
  waterSource: boolean;    // source/fontaine (proche ou éloignée)
  naturalWater: boolean;   // torrent/lac à proximité
  capacities: string[];    // '1' | '2-3' | '4-5' | '5+'
  difficulties: number[];  // 0–5
}

interface FilterPanelProps {
  filters: FilterOptions;
  onFilterChange: (filters: FilterOptions) => void;
  onClose: () => void;
}

export function FilterPanel({ filters, onFilterChange, onClose }: FilterPanelProps) {
  const toggleSeason = (season: string) => {
    const newSeasons = filters.seasons.includes(season)
      ? filters.seasons.filter((s) => s !== season)
      : [...filters.seasons, season];
    onFilterChange({ ...filters, seasons: newSeasons });
  };

  const toggleCapacity = (cap: string) => {
    const newCaps = filters.capacities.includes(cap)
      ? filters.capacities.filter((c) => c !== cap)
      : [...filters.capacities, cap];
    onFilterChange({ ...filters, capacities: newCaps });
  };

  const toggleDifficulty = (level: number) => {
    const newDiffs = filters.difficulties.includes(level)
      ? filters.difficulties.filter((d) => d !== level)
      : [...filters.difficulties, level];
    onFilterChange({ ...filters, difficulties: newDiffs });
  };

  const resetFilters = () => {
    onFilterChange({ seasons: [], waterSource: false, naturalWater: false, capacities: [], difficulties: [] });
  };

  const hasActiveFilters =
    filters.seasons.length > 0 ||
    filters.waterSource ||
    filters.naturalWater ||
    filters.capacities.length > 0 ||
    filters.difficulties.length > 0;

  const difficultyColor = (level: number) => {
    if (level === 0) return 'border-gray-500 bg-gray-100 text-gray-700';
    if (level <= 2) return 'border-green-500 bg-green-50 text-green-700';
    if (level === 3) return 'border-yellow-500 bg-yellow-50 text-yellow-700';
    return 'border-red-500 bg-red-50 text-red-700';
  };

  return (
    <Panel onClose={onClose} title="Filtres">
      {/* Saison */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Saison</h3>
        <div className="flex gap-2">
          <FilterChip
            active={filters.seasons.includes('toute-saison')}
            onClick={() => toggleSeason('toute-saison')}
            activeColor="border-amber-500 bg-amber-50 text-amber-800"
          >
            <SunSnow className="w-4 h-4" />
            Toute saison
          </FilterChip>
          <FilterChip
            active={filters.seasons.includes('hiver')}
            onClick={() => toggleSeason('hiver')}
            activeColor="border-slate-500 bg-slate-50 text-slate-800"
          >
            <Snowflake className="w-4 h-4" />
            Hiver
          </FilterChip>
        </div>
      </div>

      {/* Point d'eau */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Point d'eau</h3>
        <div className="flex flex-col gap-2">
          <FilterChip
            active={filters.waterSource}
            onClick={() => onFilterChange({ ...filters, waterSource: !filters.waterSource })}
            activeColor="border-blue-500 bg-blue-50 text-blue-800"
          >
            <Droplets className="w-4 h-4" />
            Source / fontaine à proximité
          </FilterChip>
          <FilterChip
            active={filters.naturalWater}
            onClick={() => onFilterChange({ ...filters, naturalWater: !filters.naturalWater })}
            activeColor="border-cyan-500 bg-cyan-50 text-cyan-800"
          >
            <Waves className="w-4 h-4" />
            Torrent / lac à proximité
          </FilterChip>
        </div>
      </div>

      {/* Capacité */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Capacité</h3>
        <div className="flex gap-2">
          {(['1', '2-3', '4-5', '5+'] as const).map((cap) => (
            <FilterChip
              key={cap}
              active={filters.capacities.includes(cap)}
              onClick={() => toggleCapacity(cap)}
              activeColor="border-emerald-500 bg-emerald-50 text-emerald-800"
            >
              <Tent className="w-3.5 h-3.5" />
              {cap}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* Difficulté d'accès */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Difficulté d'accès</h3>
        <div className="flex gap-1.5">
          {[0, 1, 2, 3, 4, 5].map((level) => (
            <button
              key={level}
              onClick={() => toggleDifficulty(level)}
              className={`flex-1 h-10 flex items-center justify-center rounded-lg border-2 transition-all text-sm font-bold ${
                filters.difficulties.includes(level)
                  ? difficultyColor(level)
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">0 = très facile · 3 = moyen · 5 = difficile</p>
      </div>

      {hasActiveFilters && (
        <button
          onClick={resetFilters}
          className="w-full px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors text-sm"
        >
          Réinitialiser les filtres
        </button>
      )}
    </Panel>
  );
}

function FilterChip({
  active,
  onClick,
  activeColor,
  children,
}: {
  active: boolean;
  onClick: () => void;
  activeColor: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all text-sm font-medium ${
        active ? activeColor : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
      }`}
    >
      {children}
      {active && (
        <div className="w-3.5 h-3.5 rounded-full bg-current flex items-center justify-center ml-1 opacity-70">
          <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </button>
  );
}
