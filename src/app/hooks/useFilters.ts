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
  // Nom de la trace active — permet au bouton d'enregistrement de l'outil trace d'afficher
  // "Mettre à jour «nom»" plutôt qu'un simple id opaque.
  const [activeTripName, setActiveTripName] = useState<string | null>(null);
  // Pile d'états précédents (points + trace liée), pour permettre d'annuler la dernière
  // action (point ajouté, ou vue réinitialisée) dans l'outil trace.
  const [routeHistory, setRouteHistory] = useState<Array<{
    points: Array<{ lat: number; lng: number }>;
    tripId: string | null;
    tripName: string | null;
  }>>([]);

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
    setActiveTripName(null);
    setRouteHistory([]);
  };

  const closeRoutePanel = () => {
    setIsRoutingMode(false);
    setRoutePoints([]);
    setActiveTripId(null);
    setActiveTripName(null);
    setRouteHistory([]);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setFilters(EMPTY_FILTERS);
    setRoutePoints([]);
    setActiveTripId(null);
    setActiveTripName(null);
    setRouteHistory([]);
  };

  // Charge une trace enregistrée comme itinéraire actif (utilisé par "voir sur la carte"
  // et par le toggle de trace dans le panneau Filtres — les deux doivent rester en phase).
  const activateTrip = (trip: { id: string; name: string; points: Array<{ lat: number; lng: number }> }) => {
    setRoutePoints(trip.points);
    setActiveTripId(trip.id);
    setActiveTripName(trip.name);
    setRouteHistory([]);
  };

  const deactivateTrip = () => {
    setRoutePoints([]);
    setActiveTripId(null);
    setActiveTripName(null);
  };

  // Ajoute un point au tracé en cours — utilisé par le clic sur la carte en mode routage.
  // Ne rompt plus le lien avec une trace chargée (activeTripId) : éditer une trace importée
  // reste "la même trace, modifiée", pour permettre de la mettre à jour plutôt que d'en
  // recréer une copie.
  const addRoutePoint = (point: { lat: number; lng: number }) => {
    setRouteHistory(prev => [...prev, { points: routePoints, tripId: activeTripId, tripName: activeTripName }]);
    setRoutePoints(prev => [...prev, point]);
  };

  // Réinitialise la vue de l'outil trace (n'efface pas la trace enregistrée en base).
  const clearRoute = () => {
    setRouteHistory(prev => [...prev, { points: routePoints, tripId: activeTripId, tripName: activeTripName }]);
    setRoutePoints([]);
    setActiveTripId(null);
    setActiveTripName(null);
  };

  const undoRoute = () => {
    setRouteHistory(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRoutePoints(last.points);
      setActiveTripId(last.tripId);
      setActiveTripName(last.tripName);
      return prev.slice(0, -1);
    });
  };

  const canUndo = routeHistory.length > 0;

  return {
    searchTerm, setSearchTerm,
    showFilters, setShowFilters,
    filters, setFilters,
    isRoutingMode, setIsRoutingMode,
    routePoints, setRoutePoints,
    isSmartRouting, setIsSmartRouting,
    maxDistanceFromRoute, setMaxDistanceFromRoute,
    activeTripId, setActiveTripId,
    activeTripName,
    activateTrip, deactivateTrip,
    addRoutePoint, clearRoute, undoRoute, canUndo,
    filteredLocations,
    activeFiltersCount,
    nearbyPoisCount,
    openRoutePanel,
    closeRoutePanel,
    resetFilters,
  };
}
