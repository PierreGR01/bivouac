import React from 'react';
import { Search, SlidersHorizontal, Tent, Plus, Lock, Settings, ChevronDown, X } from 'lucide-react';

interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onFilterClick: () => void;
  onAddSpotClick: () => void;
  activeFiltersCount?: number;
  isAddingMode?: boolean;
  isRoutingMode?: boolean;
  isPanelOpen?: boolean;
  isAdmin?: boolean;
  currentUser?: { email?: string } | null;
  onLoginClick?: () => void;
  onToggleZones?: () => void;
  showCustomZonesEditor?: boolean;
}

export function SearchBar({
  searchTerm,
  onSearchChange,
  onFilterClick,
  onAddSpotClick,
  activeFiltersCount = 0,
  isAddingMode = false,
  isRoutingMode = false,
  isPanelOpen = false,
  isAdmin = false,
  currentUser = null,
  onLoginClick,
  onToggleZones,
  showCustomZonesEditor = false,
}: SearchBarProps) {
  const [showSearchInput, setShowSearchInput] = React.useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!showAccountDropdown) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowAccountDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler as EventListener);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler as EventListener);
    };
  }, [showAccountDropdown]);

  return (
    <>
      {/* Mobile: unified top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-[600] pointer-events-auto">
        <div className="bg-white shadow-md">

          {/* Main bar */}
          <div className="flex items-center gap-2 px-3 py-2">
            {/* Logo — icon only, no circle */}
            <div className="bg-emerald-600 p-1.5 rounded-lg flex-shrink-0">
              <Tent className="w-4 h-4 text-white" />
            </div>

            {/* Search trigger */}
            <button
              onClick={() => setShowSearchInput(!showSearchInput)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors flex-1 min-w-0 ${
                showSearchInput ? 'bg-emerald-50' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <Search className={`w-4 h-4 flex-shrink-0 ${showSearchInput ? 'text-emerald-600' : 'text-gray-500'}`} />
              <span className={`text-sm truncate ${searchTerm ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                {searchTerm || 'Rechercher un spot...'}
              </span>
            </button>

            {/* Filters */}
            <button
              onClick={onFilterClick}
              className="relative flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0"
            >
              <SlidersHorizontal className="w-4 h-4 text-gray-700" />
              <span className="text-sm font-medium text-gray-700">Filtres</span>
              {activeFiltersCount > 0 && (
                <div className="absolute -top-1 -right-1 bg-emerald-600 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center shadow">
                  {activeFiltersCount}
                </div>
              )}
            </button>

            {/* Account button + dropdown */}
            <div className="relative flex-shrink-0" ref={dropdownRef}>
              <button
                onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors ${
                  currentUser
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span className="text-sm font-medium">{currentUser ? 'Compte' : 'Connexion'}</span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showAccountDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showAccountDropdown && (
                <div className="absolute right-0 top-full mt-1.5 bg-white shadow-2xl rounded-xl border border-gray-100 overflow-hidden min-w-[180px] z-[700]">
                  {currentUser && (
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-xs text-gray-400">Connecté en tant que</p>
                      <p className="text-sm font-semibold text-gray-800 truncate">{currentUser.email || 'Admin'}</p>
                    </div>
                  )}
                  {isAdmin && onToggleZones && (
                    <button
                      onClick={() => { onToggleZones(); setShowAccountDropdown(false); }}
                      className={`w-full flex items-center gap-2.5 px-4 py-3 text-left transition-colors ${
                        showCustomZonesEditor ? 'bg-purple-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <Settings className={`w-4 h-4 flex-shrink-0 ${showCustomZonesEditor ? 'text-purple-600' : 'text-gray-500'}`} />
                      <span className={`text-sm font-medium ${showCustomZonesEditor ? 'text-purple-700' : 'text-gray-700'}`}>
                        Zones réglementées
                      </span>
                    </button>
                  )}
                  <button
                    onClick={() => { onLoginClick?.(); setShowAccountDropdown(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <Lock className="w-4 h-4 flex-shrink-0 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">
                      {currentUser ? 'Gérer le compte' : 'Se connecter'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Expandable search input */}
          {showSearchInput && (
            <div className="px-3 pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un spot..."
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  autoFocus
                  className="pl-9 pr-9 py-2 w-full bg-gray-50 rounded-lg border border-gray-200 outline-none text-sm text-gray-800 placeholder-gray-400 transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
                {searchTerm && (
                  <button
                    onClick={() => onSearchChange('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Desktop: unchanged */}
      <div className="hidden md:block absolute top-6 left-6 z-[600] pointer-events-auto w-[480px]">
        <div className={`bg-white shadow-xl p-4 ${isPanelOpen ? 'rounded-t-xl' : 'rounded-xl'}`}>
          <div className="flex flex-col gap-3">
            {/* Logo + search */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="bg-emerald-600 p-2 rounded-lg shadow-md">
                  <Tent className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-lg font-bold text-gray-800 whitespace-nowrap">Bivouac Spots</h1>
              </div>
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

            {/* Filters + Add spot */}
            <div className="flex items-center gap-2">
              <button
                onClick={onFilterClick}
                className="relative flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <SlidersHorizontal className="w-5 h-5 text-gray-800" />
                <span className="text-sm font-medium text-gray-800">Filtres</span>
                {activeFiltersCount > 0 && (
                  <div className="bg-emerald-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-md">
                    {activeFiltersCount}
                  </div>
                )}
              </button>
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
