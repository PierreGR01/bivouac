import { useState, useEffect, useMemo } from 'react';
import { PoiLocation } from '../types';
import { FilterOptions } from '../components/FilterPanel';
import { DEFAULT_ROUTE_DISTANCE_M } from '../constants';
import { distanceToRoute } from '../utils/route-distance';

const EMPTY_FILTERS: FilterOptions = {
  seasons: [],
  waterSource: false,
  naturalWater: false,
  capacities: [],
  difficulties: [],
};

// 'été' et 'toute-annee' sont tous deux "toute saison" dans l'UI
function normalizeSeason(season: string): string {
  return season === 'été' || season === 'toute-annee' ? 'toute-saison' : season;
}

export function useFilters(locations: PoiLocation[], winterMode: boolean) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>(EMPTY_FILTERS);

  const [isRoutingMode, setIsRoutingMode] = useState(false);
  const [routePoints, setRoutePoints] = useState<Array<{ lat: number; lng: number }>>([]);
  const [isSmartRouting, setIsSmartRouting] = useState(true);
  // En mètres (le slider va de 50m à 400m) — converti en km au point d'usage, distanceToRoute
  // et getRouteBounds travaillant en kilomètres.
  const [maxDistanceFromRoute, setMaxDistanceFromRoute] = useState(DEFAULT_ROUTE_DISTANCE_M);
  // Id de la trace enregistrée actuellement chargée comme itinéraire actif (null si l'itinéraire
  // est dessiné à la main ou n'a pas encore été sauvegardé) — permet au panneau Filtres de savoir
  // quelle trace afficher comme activée.
  const [activeTripId, setActiveTripId] = useState<string | null>(null);

  // Synchroniser le mode hiver avec le filtre saison
  useEffect(() => {
    if (winterMode) {
      setFilters(prev =>
        prev.seasons.includes('hiver') ? prev : { ...prev, seasons: ['hiver'] }
      );
    } else {
      setFilters(prev =>
        prev.seasons.includes('hiver')
          ? { ...prev, seasons: prev.seasons.filter(s => s !== 'hiver') }
          : prev
      );
    }
  }, [winterMode]);

  const filteredLocations = useMemo(() => {
    return locations.filter(location => {
      const matchesSearch = location.title.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesSeason =
        filters.seasons.length === 0 ||
        filters.seasons.length === 2 ||
        filters.seasons.includes(normalizeSeason(location.season));

      const matchesWaterSource = !filters.waterSource ||
        location.waterProximity === 'proche' ||
        location.waterProximity === 'éloigné';

      const matchesNaturalWater = !filters.naturalWater ||
        location.naturalWaterProximity === 'proche';

      const matchesCapacity = filters.capacities.length === 0 ||
        (location.capacity != null && filters.capacities.includes(location.capacity));

      const matchesDifficulty = filters.difficulties.length === 0 ||
        (location.difficulty != null && filters.difficulties.includes(location.difficulty));

      let matchesRoute = true;
      if (routePoints.length >= 2) {
        matchesRoute = distanceToRoute(location.position, routePoints) <= maxDistanceFromRoute / 1000;
      }

      return matchesSearch && matchesSeason && matchesWaterSource && matchesNaturalWater &&
        matchesCapacity && matchesDifficulty && matchesRoute;
    });
  }, [locations, searchTerm, filters, routePoints, maxDistanceFromRoute]);

  const activeFiltersCount =
    (filters.seasons.length > 0 && filters.seasons.length < 2 ? 1 : 0) +
    (filters.waterSource ? 1 : 0) +
    (filters.naturalWater ? 1 : 0) +
    (filters.capacities.length > 0 ? 1 : 0) +
    (filters.difficulties.length > 0 ? 1 : 0) +
    (routePoints.length >= 2 ? 1 : 0);

  const nearbyPoisCount = useMemo(() => {
    if (routePoints.length < 2) return 0;
    return locations.filter(
      loc => distanceToRoute(loc.position, routePoints) <= maxDistanceFromRoute / 1000
    ).length;
  }, [locations, routePoints, maxDistanceFromRoute]);

  const openRoutePanel = () => {
    setIsRoutingMode(true);
    setRoutePoints([]);
    setActiveTripId(null);
  };

  const closeRoutePanel = () => {
    setIsRoutingMode(false);
    setRoutePoints([]);
    setActiveTripId(null);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setFilters(EMPTY_FILTERS);
    setRoutePoints([]);
    setActiveTripId(null);
  };

  // Charge une trace enregistrée comme itinéraire actif (utilisé par "voir sur la carte"
  // et par le toggle de trace dans le panneau Filtres — les deux doivent rester en phase).
  const activateTrip = (trip: { id: string; points: Array<{ lat: number; lng: number }> }) => {
    setRoutePoints(trip.points);
    setActiveTripId(trip.id);
  };

  const deactivateTrip = () => {
    setRoutePoints([]);
    setActiveTripId(null);
  };

  return {
    searchTerm, setSearchTerm,
    showFilters, setShowFilters,
    filters, setFilters,
    isRoutingMode, setIsRoutingMode,
    routePoints, setRoutePoints,
    isSmartRouting, setIsSmartRouting,
    maxDistanceFromRoute, setMaxDistanceFromRoute,
    activeTripId, setActiveTripId,
    activateTrip, deactivateTrip,
    filteredLocations,
    activeFiltersCount,
    nearbyPoisCount,
    openRoutePanel,
    closeRoutePanel,
    resetFilters,
  };
}
