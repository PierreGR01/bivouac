import React from 'react';
import { Search, SlidersHorizontal, Tent, Plus, User, LayoutDashboard, X, MapPin, Mountain, Loader2 } from 'lucide-react';
import { useNominatim, NominatimResult } from '../hooks/useNominatim';
import { PoiLocation } from '../types';
import { BivouacButton } from './ui/bivouac-button';
import { CountBadge } from './ui/bivouac-badge';

interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onFilterClick: () => void;
  onAddSpotClick: () => void;
  activeFiltersCount?: number;
  isAddingMode?: boolean;
  isRoutingMode?: boolean;
  isPanelOpen?: boolean;
  currentUser?: { email?: string } | null;
  onLoginClick?: () => void;
  onOpenDashboard?: () => void;
  allLocations?: PoiLocation[];
  onGeoSelect?: (lat: number, lng: number, boundingbox: [string, string, string, string]) => void;
  onSpotSelect?: (spot: PoiLocation) => void;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const OSM_TYPE_LABELS: Record<string, string> = {
  peak: 'Sommet', summit: 'Sommet', hill: 'Colline',
  pass: 'Col', saddle: 'Col',
  lake: 'Lac', reservoir: 'Lac', water: "Plan d'eau",
  river: 'Rivière', stream: 'Ruisseau',
  village: 'Village', hamlet: 'Hameau', farm: 'Ferme',
  town: 'Ville', city: 'Ville',
  forest: 'Forêt', wood: 'Forêt',
  valley: 'Vallée', ridge: 'Arête', cliff: 'Falaise',
  glacier: 'Glacier', shelter: 'Refuge', hut: 'Refuge',
};

function osmTypeLabel(cls: string, type: string): string {
  return OSM_TYPE_LABELS[type] || OSM_TYPE_LABELS[cls] || '';
}

function parseNominatimName(result: NominatimResult): { name: string; detail: string } {
  const parts = result.display_name.split(', ');
  const name = result.name || parts[0];
  const detail = parts.slice(-2).join(', ');
  return { name, detail };
}

function useNearbySpots(suggestions: NominatimResult[], allLocations: PoiLocation[] | undefined, radiusKm = 15) {
  return React.useMemo(() => {
    if (!allLocations || suggestions.length === 0) return [];

    const seen = new Set<string>();
    const results: Array<{ spot: PoiLocation; distKm: number; nearName: string }> = [];

    for (const s of suggestions) {
      const sLat = parseFloat(s.lat);
      const sLon = parseFloat(s.lon);
      const { name: osmName } = parseNominatimName(s);

      for (const loc of allLocations) {
        const d = haversineKm(sLat, sLon, loc.position.lat, loc.position.lng);
        if (d <= radiusKm) {
          if (!seen.has(loc.id)) {
            seen.add(loc.id);
            results.push({ spot: loc, distKm: d, nearName: osmName });
          } else {
            const existing = results.find(r => r.spot.id === loc.id);
            if (existing && d < existing.distKm) {
              existing.distKm = d;
              existing.nearName = osmName;
            }
          }
        }
      }
    }

    return results.sort((a, b) => a.distKm - b.distKm).slice(0, 4);
  }, [suggestions, allLocations, radiusKm]);
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
  currentUser = null,
  onLoginClick,
  onOpenDashboard,
  allLocations,
  onGeoSelect,
  onSpotSelect,
}: SearchBarProps) {
  const [showSearchInput, setShowSearchInput] = React.useState(false);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const mobileSearchRef = React.useRef<HTMLDivElement>(null);
  const desktopSearchRef = React.useRef<HTMLDivElement>(null);

  const { suggestions, isLoading: isGeoLoading } = useNominatim(searchTerm);
  const nearbySpots = useNearbySpots(suggestions, allLocations);

  const hasDropdownContent = searchTerm.trim().length >= 2 && (isGeoLoading || suggestions.length > 0 || nearbySpots.length > 0);

  const handleAccountClick = () => {
    if (currentUser) {
      onOpenDashboard?.();
    } else {
      onLoginClick?.();
    }
  };

  React.useEffect(() => {
    setShowDropdown(hasDropdownContent);
  }, [hasDropdownContent]);

  // Close dropdown on outside click
  React.useEffect(() => {
    if (!showDropdown) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      const inMobile = mobileSearchRef.current?.contains(target);
      const inDesktop = desktopSearchRef.current?.contains(target);
      if (!inMobile && !inDesktop) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler as EventListener);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler as EventListener);
    };
  }, [showDropdown]);

  const handleGeoSelect = (result: NominatimResult) => {
    onGeoSelect?.(parseFloat(result.lat), parseFloat(result.lon), result.boundingbox);
    onSearchChange('');
    setShowDropdown(false);
    setShowSearchInput(false);
  };

  const handleSpotSelect = (spot: PoiLocation) => {
    onSpotSelect?.(spot);
    onSearchChange('');
    setShowDropdown(false);
    setShowSearchInput(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && suggestions.length > 0) {
      handleGeoSelect(suggestions[0]);
    }
    if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const Dropdown = () => (
    <div className="bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden mt-1 max-h-80 overflow-y-auto">
      {isGeoLoading && suggestions.length === 0 && (
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
          Recherche en cours…
        </div>
      )}

      {suggestions.length > 0 && (
        <>
          <div className="px-4 pt-3 pb-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Lieux</span>
          </div>
          {suggestions.map((s) => {
            const { name, detail } = parseNominatimName(s);
            const typeLabel = osmTypeLabel(s.class, s.type);
            const isNatural = ['peak', 'hill', 'summit', 'pass', 'saddle', 'glacier', 'cliff', 'ridge', 'valley', 'lake', 'reservoir', 'water', 'forest', 'wood'].includes(s.type);
            return (
              <button
                key={s.place_id}
                onClick={() => handleGeoSelect(s)}
                className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-emerald-50 transition-colors text-left"
              >
                <div className="mt-0.5 flex-shrink-0">
                  {isNatural
                    ? <Mountain className="w-4 h-4 text-emerald-600" />
                    : <MapPin className="w-4 h-4 text-gray-400" />
                  }
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {name}
                    {typeLabel && <span className="ml-1.5 text-xs font-normal text-emerald-600">{typeLabel}</span>}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{detail}</p>
                </div>
              </button>
            );
          })}
        </>
      )}

      {nearbySpots.length > 0 && (
        <>
          <div className="px-4 pt-3 pb-1 border-t border-gray-100">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Spots à proximité</span>
          </div>
          {nearbySpots.map(({ spot, distKm, nearName }) => (
            <button
              key={spot.id}
              onClick={() => handleSpotSelect(spot)}
              className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-emerald-50 transition-colors text-left"
            >
              <div className="mt-0.5 flex-shrink-0">
                <Tent className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{spot.title}</p>
                <p className="text-xs text-gray-400 truncate">
                  {distKm < 1
                    ? `${Math.round(distKm * 1000)} m de ${nearName}`
                    : `${distKm.toFixed(1)} km de ${nearName}`}
                </p>
              </div>
            </button>
          ))}
        </>
      )}

      {!isGeoLoading && suggestions.length === 0 && searchTerm.trim().length >= 2 && (
        <div className="px-4 py-3 text-sm text-gray-400">Aucun lieu trouvé</div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile: unified top bar */}
      <div ref={mobileSearchRef} className="md:hidden fixed top-0 left-0 right-0 z-[600] pointer-events-auto">
        <div className="bg-white">

          {/* Main bar */}
          <div className="flex items-center gap-2 px-4 py-2.5">
            {/* Logo */}
            <div className="bg-emerald-600 p-2 rounded-lg flex-shrink-0">
              <Tent className="w-5 h-5 text-white" />
            </div>

            {/* Search trigger */}
            <button
              onClick={() => setShowSearchInput(!showSearchInput)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors flex-1 min-w-0 ${
                showSearchInput ? 'bg-emerald-50' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <Search className={`w-[17px] h-[17px] flex-shrink-0 ${showSearchInput ? 'text-emerald-600' : 'text-gray-600'}`} />
              <span className={`text-[15px] font-medium truncate ${searchTerm ? 'text-gray-800' : 'text-gray-600'}`}>
                {searchTerm || 'Recherche'}
              </span>
            </button>

            {/* Filters */}
            <button
              onClick={onFilterClick}
              className="relative flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0"
            >
              <SlidersHorizontal className="w-[17px] h-[17px] text-gray-600" />
              <span className="text-[15px] font-medium text-gray-600">Filtres</span>
              {activeFiltersCount > 0 && (
                <CountBadge count={activeFiltersCount} className="absolute -top-1 -right-1 w-4 h-4" />
              )}
            </button>

            {/* Login / dashboard — icône discrète, aucun menu */}
            <button
              onClick={handleAccountClick}
              title={currentUser ? 'Tableau de bord' : 'Connexion'}
              className={`flex-shrink-0 p-2.5 rounded-lg transition-colors ${
                currentUser
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {currentUser ? <LayoutDashboard className="w-5 h-5" /> : <User className="w-5 h-5" />}
            </button>
          </div>

          {/* Expandable search input */}
          {showSearchInput && (
            <div className="px-4 pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-[17px] h-[17px] text-gray-400" />
                <input
                  type="text"
                  placeholder="Lieu, col, sommet, village…"
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  className="pl-9 pr-9 py-2.5 w-full bg-gray-50 rounded-lg border border-gray-200 outline-none text-[15px] text-gray-800 placeholder-gray-400 transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
                {searchTerm && (
                  <button
                    onClick={() => { onSearchChange(''); setShowDropdown(false); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-[17px] h-[17px]" />
                  </button>
                )}
              </div>
              {showDropdown && <Dropdown />}
            </div>
          )}
        </div>
      </div>

      {/* Desktop: single-row header */}
      <div ref={desktopSearchRef} className="hidden md:block absolute top-6 left-6 z-[600] pointer-events-auto w-[480px]">
        <div className={`bg-white ${isPanelOpen || showDropdown ? 'rounded-t-xl' : 'rounded-xl'} px-4 py-2.5 shadow-lg`}>
          <div className="flex items-center gap-2">
            {/* Logo */}
            <div className="bg-emerald-600 p-2 rounded-lg flex-shrink-0">
              <Tent className="w-5 h-5 text-white" />
            </div>

            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-[17px] h-[17px] text-gray-400" />
              <input
                type="text"
                placeholder="Lieu, col, sommet, village…"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => { if (hasDropdownContent) setShowDropdown(true); }}
                className="pl-9 pr-4 py-2 w-full bg-gray-100 hover:bg-gray-200 rounded-lg border-0 outline-none text-sm text-gray-800 placeholder-gray-500 transition-colors focus:ring-1 focus:ring-emerald-500 focus:bg-white"
              />
            </div>

            {/* Filters */}
            <button
              onClick={onFilterClick}
              className="relative flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0"
            >
              <SlidersHorizontal className="w-[17px] h-[17px] text-gray-600" />
              <span className="text-[15px] font-medium text-gray-600">Filtres</span>
              {activeFiltersCount > 0 && (
                <CountBadge count={activeFiltersCount} className="absolute -top-1 -right-1 w-4 h-4" />
              )}
            </button>

            {/* Add spot */}
            {!isAddingMode && !isRoutingMode && (
              <BivouacButton
                variant="primary"
                size="sm"
                icon={<Plus className="w-[17px] h-[17px]" />}
                onClick={onAddSpotClick}
                className="flex-shrink-0 py-2"
              >
                Ajouter
              </BivouacButton>
            )}

            {/* Login / dashboard — icône discrète, aucun menu */}
            <button
              onClick={handleAccountClick}
              title={currentUser ? 'Tableau de bord' : 'Connexion'}
              className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
                currentUser
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {currentUser ? <LayoutDashboard className="w-[17px] h-[17px]" /> : <User className="w-[17px] h-[17px]" />}
            </button>
          </div>
        </div>

        {/* Desktop dropdown */}
        {showDropdown && <Dropdown />}
      </div>
    </>
  );
}
