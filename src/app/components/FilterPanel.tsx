import React from 'react';
import { Droplets, Snowflake, SunSnow, Waves, Tent, Mountain } from 'lucide-react';
import { Panel } from './ui/bivouac-panel';
import { BivouacButton, FilterChip } from './ui/bivouac-button';
import { DifficultySelector } from './ui/bivouac-input';

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
        <DifficultySelector
          selectedLevels={filters.difficulties}
          onToggle={toggleDifficulty}
        />
        <p className="text-xs text-gray-400 mt-1">0 = très facile · 3 = moyen · 5 = difficile</p>
      </div>

      {hasActiveFilters && (
        <BivouacButton
          variant="ghost"
          onClick={resetFilters}
          className="w-full bg-gray-100 hover:bg-gray-200 py-2.5"
        >
          Réinitialiser les filtres
        </BivouacButton>
      )}
    </Panel>
  );
}

