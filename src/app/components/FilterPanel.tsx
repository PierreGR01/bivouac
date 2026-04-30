import React from 'react';
import { X, Droplets, Snowflake, Sun } from 'lucide-react';

export interface FilterOptions {
  seasons: string[];
  waterProximity: string[]; // Peut contenir 'close' (< 100m) et/ou 'distant' (100-200m)
}

interface FilterPanelProps {
  filters: FilterOptions;
  onFilterChange: (filters: FilterOptions) => void;
  onClose: () => void;
}

export function FilterPanel({ filters, onFilterChange, onClose }: FilterPanelProps) {
  const toggleSeason = (season: string) => {
    const newSeasons = filters.seasons.includes(season)
      ? filters.seasons.filter(s => s !== season)
      : [...filters.seasons, season];
    onFilterChange({ ...filters, seasons: newSeasons });
  };

  const toggleWaterProximity = (proximity: string) => {
    const newProximity = filters.waterProximity.includes(proximity)
      ? filters.waterProximity.filter(p => p !== proximity)
      : [...filters.waterProximity, proximity];
    onFilterChange({ ...filters, waterProximity: newProximity });
  };

  const resetFilters = () => {
    onFilterChange({ seasons: [], waterProximity: [] });
  };

  const hasActiveFilters = filters.seasons.length > 0 || filters.waterProximity.length > 0;

  return (
    <>
      {/* Mobile: panneau du bas */}
      <div 
        className="md:hidden fixed inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl z-[1000]"
        style={{
          maxHeight: 'calc(100vh - 120px)',
          animation: 'slideUp 0.3s ease-out'
        }}
      >
        <style>{`
          @keyframes slideUp {
            from {
              transform: translateY(100%);
            }
            to {
              transform: translateY(0);
            }
          }
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
        `}</style>
        
        {/* Poignée de glissement */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Bouton fermer */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Contenu scrollable */}
        <div className="overflow-y-auto px-6 pb-6" style={{ maxHeight: 'calc(100vh - 180px)' }}>
          <FilterContent 
            filters={filters}
            toggleSeason={toggleSeason}
            toggleWaterProximity={toggleWaterProximity}
            resetFilters={resetFilters}
            hasActiveFilters={hasActiveFilters}
          />
        </div>
      </div>

      {/* Desktop: panneau latéral gauche */}
      <div 
        className="hidden md:block fixed top-[158px] left-6 w-[480px] bg-white shadow-2xl z-[500] rounded-b-xl"
        style={{
          animation: 'fadeIn 0.3s ease-out',
          maxHeight: 'calc(100vh - 10.5rem)'
        }}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between px-6 py-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">Filtres</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-800" />
          </button>
        </div>

        {/* Contenu scrollable */}
        <div className="overflow-y-auto px-6 py-6" style={{ maxHeight: 'calc(100vh - 10.5rem)' }}>
          <FilterContent 
            filters={filters}
            toggleSeason={toggleSeason}
            toggleWaterProximity={toggleWaterProximity}
            resetFilters={resetFilters}
            hasActiveFilters={hasActiveFilters}
          />
        </div>
      </div>
    </>
  );
}

// Composant pour le contenu partagé
function FilterContent({ 
  filters, 
  toggleSeason, 
  toggleWaterProximity, 
  resetFilters, 
  hasActiveFilters 
}: { 
  filters: FilterOptions;
  toggleSeason: (season: string) => void;
  toggleWaterProximity: (proximity: string) => void;
  resetFilters: () => void;
  hasActiveFilters: boolean;
}) {
  return (
    <>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Saison</h3>
        <div className="flex gap-2">
          {/* Été */}
          <button
            onClick={() => toggleSeason('été')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
              filters.seasons.includes('été')
                ? 'border-orange-600 bg-orange-50'
                : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
          >
            <Sun className={`w-5 h-5 ${
              filters.seasons.includes('été') ? 'text-orange-700' : 'text-gray-600'
            }`} />
            <span className={`font-medium text-sm ${
              filters.seasons.includes('été') ? 'text-orange-900' : 'text-gray-700'
            }`}>
              Été
            </span>
            {filters.seasons.includes('été') && (
              <div className="w-4 h-4 bg-orange-600 rounded-full flex items-center justify-center ml-1">
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>

          {/* Hiver */}
          <button
            onClick={() => toggleSeason('hiver')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
              filters.seasons.includes('hiver')
                ? 'border-slate-600 bg-slate-50'
                : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
          >
            <Snowflake className={`w-5 h-5 ${
              filters.seasons.includes('hiver') ? 'text-slate-700' : 'text-gray-600'
            }`} />
            <span className={`font-medium text-sm ${
              filters.seasons.includes('hiver') ? 'text-slate-900' : 'text-gray-700'
            }`}>
              Hiver
            </span>
            {filters.seasons.includes('hiver') && (
              <div className="w-4 h-4 bg-slate-600 rounded-full flex items-center justify-center ml-1">
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Point d'eau */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Point d'eau</h3>
        <div className="flex gap-2">
          {/* Eau proche */}
          <button
            onClick={() => toggleWaterProximity('close')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
              filters.waterProximity.includes('close')
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
          >
            <Droplets className={`w-5 h-5 ${
              filters.waterProximity.includes('close') ? 'text-blue-700' : 'text-gray-600'
            }`} />
            <span className={`font-medium text-sm ${
              filters.waterProximity.includes('close') ? 'text-blue-900' : 'text-gray-700'
            }`}>
              &lt; 100m
            </span>
            {filters.waterProximity.includes('close') && (
              <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center ml-1">
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>

          {/* Eau éloignée */}
          <button
            onClick={() => toggleWaterProximity('distant')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
              filters.waterProximity.includes('distant')
                ? 'border-cyan-600 bg-cyan-50'
                : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
          >
            <Droplets className={`w-5 h-5 ${
              filters.waterProximity.includes('distant') ? 'text-cyan-700' : 'text-gray-600'
            }`} />
            <span className={`font-medium text-sm ${
              filters.waterProximity.includes('distant') ? 'text-cyan-900' : 'text-gray-700'
            }`}>
              100-200m
            </span>
            {filters.waterProximity.includes('distant') && (
              <div className="w-4 h-4 bg-cyan-600 rounded-full flex items-center justify-center ml-1">
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Bouton réinitialiser */}
      {hasActiveFilters && (
        <button
          onClick={resetFilters}
          className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-lg transition-colors border border-gray-200"
        >
          Réinitialiser les filtres
        </button>
      )}
    </>
  );
}
