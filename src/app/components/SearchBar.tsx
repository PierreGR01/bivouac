import React from 'react';
import { Search, SlidersHorizontal, Tent, Plus } from 'lucide-react';

interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onFilterClick: () => void;
  onAddSpotClick: () => void;
  activeFiltersCount?: number;
  isAddingMode?: boolean;
  isRoutingMode?: boolean;
  isPanelOpen?: boolean;
}

export function SearchBar({ 
  searchTerm, 
  onSearchChange, 
  onFilterClick, 
  onAddSpotClick, 
  activeFiltersCount = 0, 
  isAddingMode = false, 
  isRoutingMode = false, 
  isPanelOpen = false
}: SearchBarProps) {
  const [showSearchInput, setShowSearchInput] = React.useState(false);

  return (
    <>
      {/* Mobile: Logo en haut à gauche et icône recherche en haut à droite */}
      <div className="md:hidden">
        {/* Logo */}
        <div className="absolute top-6 left-6 z-[600] pointer-events-auto">
          <div className="w-14 h-14 bg-emerald-600 rounded-full shadow-xl flex items-center justify-center">
            <Tent className="w-6 h-6 text-white" />
          </div>
        </div>

        {/* Icône recherche */}
        <div className="absolute top-6 right-6 z-[600] pointer-events-auto">
          <button
            onClick={() => setShowSearchInput(!showSearchInput)}
            className="w-14 h-14 bg-white rounded-full shadow-xl flex items-center justify-center hover:bg-gray-50 transition-colors"
            title="Rechercher"
          >
            <Search className="w-6 h-6 text-gray-800" />
          </button>
        </div>

        {/* Champ de recherche mobile (s'affiche quand on clique sur l'icône) */}
        {showSearchInput && (
          <div className="absolute top-20 left-6 right-6 z-[600] pointer-events-auto">
            <div className="bg-white shadow-xl rounded-lg p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-700" />
                <input
                  type="text"
                  placeholder="Rechercher un spot..."
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  autoFocus
                  className="pl-10 pr-4 py-2 w-full bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 outline-none text-gray-800 placeholder-gray-500 transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Desktop: Version complète */}
      <div className="hidden md:block absolute top-6 left-6 z-[600] pointer-events-auto w-[480px]">
        <div className={`bg-white shadow-xl p-4 ${isPanelOpen ? 'rounded-t-xl' : 'rounded-xl'}`}>
          <div className="flex flex-col gap-3">
            {/* Ligne 1: Logo + Recherche */}
            <div className="flex items-center gap-3">
              {/* Logo */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="bg-emerald-600 p-2 rounded-lg shadow-md">
                  <Tent className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-lg font-bold text-gray-800 drop-shadow-sm whitespace-nowrap">Bivouac Spots</h1>
              </div>

              {/* Champ de recherche */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-700" />
                <input
                  type="text"
                  placeholder="Rechercher un spot..."
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 outline-none text-gray-800 placeholder-gray-500 transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Ligne 2: Filtres + Ajouter un spot (desktop uniquement) */}
            <div className="flex items-center gap-2">
              {/* Bouton Filtres */}
              <button
                onClick={onFilterClick}
                className="relative flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                title="Filtres"
              >
                <SlidersHorizontal className="w-5 h-5 text-gray-800" />
                <span className="text-sm font-medium text-gray-800">Filtres</span>
                {activeFiltersCount > 0 && (
                  <div className="bg-emerald-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-md">
                    {activeFiltersCount}
                  </div>
                )}
              </button>

              {/* Bouton Ajouter un spot */}
              {!isAddingMode && !isRoutingMode && (
                <button
                  onClick={onAddSpotClick}
                  className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors shadow-md ml-auto"
                >
                  <Plus className="w-5 h-5" />
                  <span className="text-sm">Ajouter un spot</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
