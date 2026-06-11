import { useState, useEffect, useMemo } from 'react';
import { PoiLocation } from '../types';
import { FilterOptions } from '../components/FilterPanel';
import { DEFAULT_ROUTE_DISTANCE_KM } from '../constants';
import { distanceToRoute } from '../utils/route-distance';

export function useFilters(locations: PoiLocation[], winterMode: boolean) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({ seasons: [], waterProximity: [] });

  const [isRoutingMode, setIsRoutingMode] = useState(false);
  const [routePoints, setRoutePoints] = useState<Array<{ lat: number; lng: number }>>([]);
  const [isSmartRouting, setIsSmartRouting] = useState(true);
  const [maxDistanceFromRoute, setMaxDistanceFromRoute] = useState(DEFAULT_ROUTE_DISTANCE_KM);

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
        filters.seasons.includes(location.season);

      let matchesWater = true;
      if (filters.waterProximity.length > 0 && filters.waterProximity.length < 2) {
        if (filters.waterProximity.includes('close')) {
          matchesWater = location.waterProximity === 'proche';
        } else if (filters.waterProximity.includes('distant')) {
          matchesWater = location.waterProximity === 'éloigné';
        }
      }

      let matchesRoute = true;
      if (routePoints.length >= 2) {
        matchesRoute = distanceToRoute(location.position, routePoints) <= maxDistanceFromRoute;
      }

      return matchesSearch && matchesSeason && matchesWater && matchesRoute;
    });
  }, [locations, searchTerm, filters, routePoints, maxDistanceFromRoute]);

  const activeFiltersCount =
    (filters.seasons.length > 0 && filters.seasons.length < 2 ? 1 : 0) +
    (filters.waterProximity.length > 0 && filters.waterProximity.length < 2 ? 1 : 0) +
    (routePoints.length >= 2 ? 1 : 0);

  const nearbyPoisCount = useMemo(() => {
    if (routePoints.length < 2) return 0;
    return locations.filter(
      loc => distanceToRoute(loc.position, routePoints) <= maxDistanceFromRoute
    ).length;
  }, [locations, routePoints, maxDistanceFromRoute]);

  const openRoutePanel = () => {
    setIsRoutingMode(true);
    setRoutePoints([]);
  };

  const closeRoutePanel = () => {
    setIsRoutingMode(false);
    setRoutePoints([]);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setFilters({ seasons: [], waterProximity: [] });
    setRoutePoints([]);
  };

  return {
    searchTerm, setSearchTerm,
    showFilters, setShowFilters,
    filters, setFilters,
    isRoutingMode, setIsRoutingMode,
    routePoints, setRoutePoints,
    isSmartRouting, setIsSmartRouting,
    maxDistanceFromRoute, setMaxDistanceFromRoute,
    filteredLocations,
    activeFiltersCount,
    nearbyPoisCount,
    openRoutePanel,
    closeRoutePanel,
    resetFilters,
  };
}
