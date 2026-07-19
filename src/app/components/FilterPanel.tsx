import React, { useState } from 'react';
import { Droplets, Snowflake, SunSnow, Waves, Tent, Mountain, Route, ChevronDown, ChevronUp } from 'lucide-react';
import { Panel } from './ui/bivouac-panel';
import { BivouacButton, FilterChip } from './ui/bivouac-button';
import { DifficultySelector, RangeSlider } from './ui/bivouac-input';
import { InfoCard } from './ui/bivouac-card';
import { Trip } from '../../utils/supabase/trips-api';

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
  trips: Trip[];
  activeTripId: string | null;
  onToggleTrip: (trip: Trip) => void;
  maxDistanceFromRoute: number;
  onMaxDistanceChange: (value: number) => void;
  nearbyPoisCount: number;
  nearbyWaterCount: number;
  isLoadingWaterCount?: boolean;
}

export function FilterPanel({
  filters,
  onFilterChange,
  onClose,
  trips,
  activeTripId,
  onToggleTrip,
  maxDistanceFromRoute,
  onMaxDistanceChange,
  nearbyPoisCount,
  nearbyWaterCount,
  isLoadingWaterCount = false,
}: FilterPanelProps) {
  const [showTraces, setShowTraces] = useState(() => activeTripId !== null);

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
      {/* Traces enregistrées */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setShowTraces((v) => !v)}
          className="w-full flex items-center justify-between mb-3"
        >
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
            Traces enregistrées
            {activeTripId && (
              <span className="normal-case text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                1 active
              </span>
            )}
          </h3>
          {showTraces ? (
            <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
          )}
        </button>
        {showTraces && (
          trips.length === 0 ? (
            <p className="text-xs text-gray-400">Aucune trace enregistrée pour le moment.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {trips.map((trip) => (
                <label
                  key={trip.id}
                  className="flex items-center gap-3 cursor-pointer p-2.5 border border-gray-200 rounded-lg hover:border-emerald-300 transition-colors bg-white"
                >
                  <input
                    type="checkbox"
                    checked={activeTripId === trip.id}
                    onChange={() => onToggleTrip(trip)}
                    className="w-5 h-5 text-emerald-600 rounded focus:ring-2 focus:ring-emerald-500 flex-shrink-0"
                  />
                  <Route className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="text-sm text-gray-800 flex-1 truncate">{trip.name}</span>
                </label>
              ))}
            </div>
          )
        )}
        {showTraces && activeTripId && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <RangeSlider
              label="Périmètre autour de la trace"
              min="50"
              max="400"
              step="25"
              value={maxDistanceFromRoute}
              onChange={(e) => onMaxDistanceChange(parseFloat(e.target.value))}
              unit="m"
              displayValue={maxDistanceFromRoute}
            />
            <div className="grid grid-cols-2 gap-2 mt-3">
              <InfoCard title="Spots à proximité" value={nearbyPoisCount} variant="emerald" />
              <InfoCard
                title="Points d'eau à proximité"
                value={isLoadingWaterCount ? 'Recherche…' : nearbyWaterCount}
                variant="blue"
              />
            </div>
          </div>
        )}
      </div>

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

