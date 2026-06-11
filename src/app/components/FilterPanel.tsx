import React from 'react';
import { Droplets, Snowflake, Sun } from 'lucide-react';
import { Panel } from './ui/bivouac-panel';

export interface FilterOptions {
  seasons: string[];
  waterProximity: string[];
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

  const toggleWaterProximity = (proximity: string) => {
    const newProximity = filters.waterProximity.includes(proximity)
      ? filters.waterProximity.filter((p) => p !== proximity)
      : [...filters.waterProximity, proximity];
    onFilterChange({ ...filters, waterProximity: newProximity });
  };

  const resetFilters = () => {
    onFilterChange({ seasons: [], waterProximity: [] });
  };

  const hasActiveFilters = filters.seasons.length > 0 || filters.waterProximity.length > 0;

  return (
    <Panel onClose={onClose} title="Filtres">
      {/* Saison */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Saison</h3>
        <div className="flex gap-2">
          <FilterChip
            active={filters.seasons.includes('été')}
            onClick={() => toggleSeason('été')}
            activeColor="border-orange-500 bg-orange-50 text-orange-800"
          >
            <Sun className="w-4 h-4" />
            Été
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
        <div className="flex gap-2">
          <FilterChip
            active={filters.waterProximity.includes('close')}
            onClick={() => toggleWaterProximity('close')}
            activeColor="border-blue-500 bg-blue-50 text-blue-800"
          >
            <Droplets className="w-4 h-4" />
            &lt; 100m
          </FilterChip>
          <FilterChip
            active={filters.waterProximity.includes('distant')}
            onClick={() => toggleWaterProximity('distant')}
            activeColor="border-cyan-500 bg-cyan-50 text-cyan-800"
          >
            <Droplets className="w-4 h-4" />
            100–200m
          </FilterChip>
        </div>
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
