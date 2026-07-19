import React, { useState, useRef, useMemo, Suspense } from 'react';
import { toast, Toaster } from 'sonner';
import { devLog } from './utils/logger';
import { MapView } from './components/MapView';
import { SearchBar } from './components/SearchBar';
import { FilterOptions } from './components/FilterPanel';
import { NewPoi } from './components/AddPoiPanel';
import { MOBILE_BREAKPOINT_PX } from './constants';
import { useAuth } from './contexts/AuthContext';
import { isSpotDisabled } from './utils/spot-status';
import { Tent, Plus, Loader2, AlertCircle, Settings, Search, BanIcon, Droplet, ChevronUp, ChevronDown, Snowflake, Locate, CloudRain } from 'lucide-react';
import { usePois } from './hooks/usePois';
import { useMapLayers } from './hooks/useMapLayers';
import { useFilters } from './hooks/useFilters';
import { useTrips } from './hooks/useTrips';
import { Trip } from '../utils/supabase/trips-api';
import { CustomZone } from '../utils/supabase/custom-zones-api';
import { AdminZone } from '../utils/supabase/admin-zones-api';
import { ProtectedArea } from './services/protected-areas';
import { PoiLocation } from './types';

const PoiDetailsPanel = React.lazy(() => import('./components/PoiDetailsPanel').then(m => ({ default: m.PoiDetailsPanel })));
const AddPoiPanel = React.lazy(() => import('./components/AddPoiPanel').then(m => ({ default: m.AddPoiPanel })));
const RoutePanel = React.lazy(() => import('./components/RoutePanel').then(m => ({ default: m.RoutePanel })));
const FilterPanel = React.lazy(() => import('./components/FilterPanel').then(m => ({ default: m.FilterPanel })));
const LoginPanel = React.lazy(() => import('./components/LoginPanel').then(m => ({ default: m.LoginPanel })));
const CustomZonesEditor = React.lazy(() => import('./components/CustomZonesEditor').then(m => ({ default: m.CustomZonesEditor })));
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const UserDashboard = React.lazy(() => import('./components/UserDashboard').then(m => ({ default: m.UserDashboard })));
const ServerStatus = React.lazy(() => import('./components/ServerStatus').then(m => ({ default: m.ServerStatus })));
const WaterPointsInfo = React.lazy(() => import('./components/WaterPointsInfo').then(m => ({ default: m.WaterPointsInfo })));
const ZoneInfoPanel = React.lazy(() => import('./components/ZoneInfoPanel').then(m => ({ default: m.ZoneInfoPanel })));

export default function App() {
  const { currentUser, isAdmin, isSuperAdmin, zoneAdminIds } = useAuth();

  const pois = usePois();
  const trips = useTrips();
  const map = useMapLayers();
  const visibleLocations = useMemo(
    () => isAdmin ? pois.locations : pois.locations.filter(l => !isSpotDisabled(l)),
    [pois.locations, isAdmin]
  );
  const filters = useFilters(visibleLocations, map.winterMode);

  // UI mode state (stays in App — pure UI concerns)
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [temporaryPosition, setTemporaryPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [editingPoi, setEditingPoi] = useState<PoiLocation | null>(null);
  const [isMeasuringMode, setIsMeasuringMode] = useState(false);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawnGeometry, setDrawnGeometry] = useState<GeoJSON.Feature | null>(null);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [showLoginPanel, setShowLoginPanel] = useState(false);
  const [showCustomZonesEditor, setShowCustomZonesEditor] = useState(false);
  const [editingZone, setEditingZone] = useState<CustomZone | null>(null);
  const [editingOsmZone, setEditingOsmZone] = useState<ProtectedArea | null>(null);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [showUserDashboard, setShowUserDashboard] = useState(false);
  const [showAdminZoneEditor, setShowAdminZoneEditor] = useState(false);
  const [editingAdminZone, setEditingAdminZone] = useState<AdminZone | null>(null);
  const [previewGeometry, setPreviewGeometry] = useState<GeoJSON.Feature | null>(null);
  const [showMobileOptions, setShowMobileOptions] = useState(false);
  const [attribOpen, setAttribOpen] = useState(false);
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedZone, setSelectedZone] = useState<CustomZone | null>(null);
  const [selectedProtectedArea, setSelectedProtectedArea] = useState<ProtectedArea | null>(null);
  const [nearbyWaterCount, setNearbyWaterCount] = useState(0);
  const [isLoadingRouteWater, setIsLoadingRouteWater] = useState(false);
  const requestCloseZoneForm = useRef<(() => void) | null>(null);

  // Le dashboard n'est réellement affiché que pour un compte admin — évite un état
  // "showAdminDashboard=true" orphelin (header masqué, rien affiché à la place) pour un
  // utilisateur connecté non-admin.
  const dashboardActive = isAdmin && showAdminDashboard;
  // Dashboard personnel : réservé aux utilisateurs connectés non-admin (les admins passent
  // toujours par AdminDashboard, cf. dashboardActive ci-dessus).
  const userDashboardActive = !isAdmin && !!currentUser && showUserDashboard;
  const anyDashboardActive = dashboardActive || userDashboardActive;

  // --- Composed handlers ---

  const handleLocationClick = (location: typeof pois.selectedLocation) => {
    pois.setSelectedLocation(location);
    filters.setShowFilters(false);
  };

  const handleClosePanel = () => pois.setSelectedLocation(null);

  const handleOpenAddPanel = () => {
    if (!currentUser) {
      setShowLoginPanel(true);
      return;
    }
    setIsAddingMode(true);
    pois.setSelectedLocation(null);
    setTemporaryPosition(null);
    filters.setShowFilters(false);
  };

  const handleCloseAddPanel = () => {
    setIsAddingMode(false);
    setTemporaryPosition(null);
  };

  const handleOpenRoutePanel = () => {
    filters.openRoutePanel();
    pois.setSelectedLocation(null);
    filters.setShowFilters(false);
    setIsAddingMode(false);
    setIsMeasuringMode(false);
  };

  const handleSaveRoute = async (name: string) => {
    const success = await trips.saveTrip({ name, points: filters.routePoints, source: 'drawn' });
    if (success) {
      filters.closeRoutePanel();
    }
  };

  // Recharge le tracé d'un trip enregistré dans l'éditeur d'itinéraire existant (modifiable/
  // ré-enregistrable), plutôt qu'une nouvelle couche carte en lecture seule dédiée.
  const handleViewTripOnMap = (trip: Trip) => {
    filters.activateTrip(trip);
    filters.setIsRoutingMode(true);
    if (window.innerWidth < MOBILE_BREAKPOINT_PX) {
      setShowUserDashboard(false);
      const first = trip.points[0];
      if (first) (window as any).__mapFlyToSpot?.(first.lat, first.lng);
    }
  };

  // Activer/désactiver une trace enregistrée depuis le panneau Filtres — un seul itinéraire
  // pouvant être actif à la fois, activer une trace remplace celle éventuellement en cours.
  const handleToggleTrip = (trip: Trip) => {
    if (filters.activeTripId === trip.id) {
      filters.deactivateTrip();
    } else {
      filters.activateTrip(trip);
    }
  };

  const handleToggleMeasureMode = () => {
    setIsMeasuringMode(prev => !prev);
    filters.setIsRoutingMode(false);
    setIsAddingMode(false);
    pois.setSelectedLocation(null);
    filters.setShowFilters(false);
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (isAddingMode) {
      setTemporaryPosition({ lat, lng });
    } else if (filters.isRoutingMode) {
      filters.setRoutePoints(prev => [...prev, { lat, lng }]);
      // L'itinéraire s'écarte désormais de la trace enregistrée chargée, le cas échéant.
      if (filters.activeTripId) filters.setActiveTripId(null);
    } else if (showCustomZonesEditor && (editingZone || editingOsmZone)) {
      requestCloseZoneForm.current?.();
    } else if (showAdminZoneEditor && editingAdminZone) {
      requestCloseZoneForm.current?.();
    }
  };

  const handleSubmitPoi = async (newPoi: NewPoi) => {
    await pois.submitPoi(newPoi, map.waterPoints, () => {
      setIsAddingMode(false);
      setTemporaryPosition(null);
    });
  };

  const handleOpenEditPanel = () => {
    setEditingPoi(pois.selectedLocation);
    pois.setSelectedLocation(null);
  };

  const handleUpdatePoi = async (poiId: string, updates: NewPoi) => {
    const success = await pois.updateSpot(poiId, updates);
    toast[success ? 'success' : 'error'](success ? 'Spot mis à jour' : 'Échec de la mise à jour du spot');
    setEditingPoi(null);
  };

  const handleToggleCustomZones = () => {
    if (showCustomZonesEditor) {
      setShowCustomZonesEditor(false);
      setIsDrawingMode(false);
      setEditingZone(null);
    } else {
      setShowAdminZoneEditor(false);
      setEditingAdminZone(null);
      setShowCustomZonesEditor(true);
      setIsDrawingMode(true);
    }
  };

  const handleZoneClick = (zone: CustomZone) => {
    if (!isAdmin) return;
    // Un admin de zone qui n'administre pas le territoire de rattachement de cette zone
    // n'a accès qu'à la vue info, pas au formulaire d'édition (refusé de toute façon côté RLS).
    if (!isSuperAdmin && !(zone.admin_zone_id && zoneAdminIds.includes(zone.admin_zone_id))) {
      handleZoneInfoClick(zone);
      return;
    }
    setEditingZone(zone);
    setEditingOsmZone(null);
    setShowCustomZonesEditor(true);
    setIsDrawingMode(false);
  };

  const handleOpenAdminDashboard = () => {
    setShowCustomZonesEditor(false);
    setIsDrawingMode(false);
    setEditingZone(null);
    setShowAdminZoneEditor(false);
    setEditingAdminZone(null);
    setShowAdminDashboard(true);
  };

  const handleOpenDashboard = () => {
    if (isAdmin) {
      handleOpenAdminDashboard();
      return;
    }
    if (!currentUser) return;
    pois.setSelectedLocation(null);
    setIsAddingMode(false);
    filters.setShowFilters(false);
    setShowUserDashboard(true);
  };

  // Anciens boutons flottants "Zones"/"Territoires" — intégrés au dashboard, celui-ci se
  // ferme donc pour laisser place au flux existant (dessin sur la carte, gestion des zones).
  const handleOpenZonesFromDashboard = () => {
    setShowAdminDashboard(false);
    handleToggleCustomZones();
  };

  // Dessiner/modifier un territoire nécessite la carte plein écran (contrairement à la
  // simple consultation "qui administre quelle zone", intégrée au dashboard) — on ferme
  // donc le dashboard uniquement pour ces deux actions.
  const handleOpenTerritoryEditorFromDashboard = (zone?: AdminZone) => {
    setShowAdminDashboard(false);
    if (zone) {
      handleEditAdminZone(zone);
    } else {
      handleCreateAdminZone();
    }
  };

  // Action "Carte" du tableau du dashboard : le pin passe en état sélectionné et la carte
  // s'anime vers lui. Sur desktop, le dashboard reste ouvert (vue scindée) — le spot est donc
  // centré dans la portion de carte encore visible, pas au centre géométrique (caché sous le
  // dashboard). Sur mobile, il n'y a pas la place pour les deux, donc on le referme.
  const handleViewSpotOnMap = (poi: PoiLocation) => {
    pois.setSelectedLocation(poi);
    if (window.innerWidth < MOBILE_BREAKPOINT_PX) {
      setShowAdminDashboard(false);
      setShowUserDashboard(false);
      (window as any).__mapFlyToSpot?.(poi.position.lat, poi.position.lng);
    } else {
      const panelWidth = window.innerWidth / 2;
      (window as any).__mapFlyToSpotSplit?.(poi.position.lat, poi.position.lng, panelWidth);
    }
  };

  const handleCreateAdminZone = () => {
    setEditingAdminZone(null);
    setShowAdminZoneEditor(true);
    setIsDrawingMode(true);
  };

  const handleEditAdminZone = (zone: AdminZone) => {
    setEditingAdminZone(zone);
    setShowAdminZoneEditor(true);
    setIsDrawingMode(false);
  };

  // Retour au dashboard (et non à un panneau "territoires" séparé) une fois le tracé
  // créé/modifié — la gestion des territoires vit désormais dans le dashboard.
  const handleCloseAdminZoneEditor = () => {
    setShowAdminZoneEditor(false);
    setIsDrawingMode(false);
    setDrawnGeometry(null);
    setEditingAdminZone(null);
    setShowAdminDashboard(true);
  };

  const handleOsmZoneClick = (area: ProtectedArea) => {
    if (!isAdmin) return;
    setEditingOsmZone(area);
    setEditingZone(null);
    setShowCustomZonesEditor(true);
    setIsDrawingMode(false);
  };

  const handleZoneInfoClick = (zone: CustomZone) => {
    setSelectedZone(zone);
    setSelectedProtectedArea(null);
    setShowMobileOptions(false);
  };

  const handleProtectedAreaInfoClick = (area: ProtectedArea) => {
    setSelectedProtectedArea(area);
    setSelectedZone(null);
    setShowMobileOptions(false);
  };

  const handleCloseZoneInfo = () => {
    setSelectedZone(null);
    setSelectedProtectedArea(null);
  };

  const isPanelOpen =
    pois.selectedLocation !== null || isAddingMode || filters.showFilters || filters.isRoutingMode
    || selectedZone !== null || selectedProtectedArea !== null;

  return (
    <div className="relative w-screen overflow-hidden" style={{ height: '100dvh' }}>

      {/* Search bar — masquée quand un dashboard (admin ou personnel) est actif (page dédiée) */}
      {!anyDashboardActive && (
        <div>
          <SearchBar
            searchTerm={filters.searchTerm}
            onSearchChange={filters.setSearchTerm}
            onFilterClick={() => filters.setShowFilters(!filters.showFilters)}
            onAddSpotClick={handleOpenAddPanel}
            activeFiltersCount={filters.activeFiltersCount}
            isAddingMode={isAddingMode}
            isRoutingMode={filters.isRoutingMode}
            isPanelOpen={isPanelOpen}
            currentUser={currentUser}
            onLoginClick={() => setShowLoginPanel(!showLoginPanel)}
            onOpenDashboard={handleOpenDashboard}
            allLocations={visibleLocations}
            onGeoSelect={(lat, lng, bbox) => {
              (window as any).__mapFitBounds?.(bbox, lat, lng);
            }}
            onSpotSelect={(spot) => {
              handleLocationClick(spot);
              (window as any).__mapPanToSpot?.(spot.position.lat, spot.position.lng);
            }}
          />
        </div>
      )}

      {/* Diagnostic serveur — désormais seul bouton flottant desktop, indépendant de l'admin */}
      {!anyDashboardActive && !pois.serverAvailable && !isAddingMode && (
        <div className="hidden md:flex absolute top-6 right-6 z-[600] items-center gap-3">
          <button
            onClick={() => setShowDiagnostic(!showDiagnostic)}
            className="flex items-center gap-2 px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors shadow-lg"
            title="Diagnostic du serveur"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Loading overlay */}
      {pois.isLoading && (
        <div className="absolute inset-0 z-[600] backdrop-blur-sm flex items-center justify-center">
          <div className="text-center bg-white rounded-2xl shadow-2xl p-8 max-w-md mx-4">
            <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-700 font-medium">Chargement des points de bivouac...</p>
          </div>
        </div>
      )}

      {/* No results message */}
      {!pois.isLoading && filters.filteredLocations.length === 0 && !isAddingMode && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[500] bg-white rounded-xl shadow-lg p-6 text-center max-w-sm">
          <div className="text-gray-400 mb-3">
            <Search className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun spot trouvé</h3>
          <p className="text-sm text-gray-600 mb-4">
            {filters.searchTerm || filters.activeFiltersCount > 0
              ? 'Essayez de modifier vos critères de recherche ou de filtres.'
              : 'Aucun spot de bivouac disponible pour le moment.'}
          </p>
          {(filters.searchTerm || filters.activeFiltersCount > 0) && (
            <button
              onClick={filters.resetFilters}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Réinitialiser
            </button>
          )}
        </div>
      )}

      {/* Saving overlay */}
      {pois.isSaving && (
        <div className="absolute inset-0 z-[1100] bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 shadow-2xl text-center">
            <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-700 font-medium">Enregistrement en cours...</p>
          </div>
        </div>
      )}

      {/* Map */}
      <div className="h-full w-full">
        <MapView
          locations={filters.filteredLocations}
          onLocationClick={handleLocationClick}
          selectedLocation={pois.selectedLocation}
          isAddingMode={isAddingMode}
          isRoutingMode={filters.isRoutingMode}
          isMeasuringMode={isMeasuringMode}
          isDrawingMode={isDrawingMode}
          onMapClick={handleMapClick}
          onGeometryDrawn={(geometry) => {
            setDrawnGeometry(geometry);
            setIsDrawingMode(false);
          }}
          previewGeometry={previewGeometry}
          temporaryMarkerPosition={temporaryPosition}
          routePoints={filters.routePoints}
          isSmartRouting={filters.isSmartRouting}
          maxDistanceFromRoute={filters.maxDistanceFromRoute}
          onNearbyWaterCountChange={setNearbyWaterCount}
          onRouteWaterLoadingChange={setIsLoadingRouteWater}
          showWaterPoints={map.showWaterPoints}
          showProtectedAreas={map.showProtectedAreas}
          protectedAreas={map.allProtectedAreas}
          customZones={map.customZones}
          onZoneClick={isAdmin ? handleZoneClick : handleZoneInfoClick}
          onProtectedAreaClick={isAdmin ? handleOsmZoneClick : handleProtectedAreaInfoClick}
          onMapMove={(bounds) => map.setMapBounds(bounds)}
          showWeather={map.showWeather}
          onWeatherToggle={map.toggleWeather}
          satelliteMode={map.satelliteMode}
          onSatelliteModeToggle={map.toggleSatellite}
          winterMode={map.winterMode}
          onWinterModeToggle={map.toggleWinter}
          onWaterStateChange={({ isLoading, showButton }) => {
            map.setIsLoadingWaterPoints(isLoading);
            // La condition de rendu gère déjà map.showWaterPoints — pas besoin de la tester ici
            map.setShowWaterPointsButton(showButton);
          }}
          onWaterPointsLoaded={map.setWaterPoints}
          onWaterPointsToggle={map.toggleWaterPoints}
          onProtectedAreasToggle={map.toggleProtectedAreas}
          onRouteClick={handleOpenRoutePanel}
          onMeasureClick={handleToggleMeasureMode}
          userPosition={userPosition}
          selectedZone={selectedZone || editingZone}
          selectedProtectedArea={selectedProtectedArea || editingOsmZone}
        />
      </div>

      {/* Water/protected areas loading indicators — desktop only */}
      {!isAddingMode && !(pois.selectedLocation && window.innerWidth < MOBILE_BREAKPOINT_PX) && !(selectedZone || selectedProtectedArea) && (
        <div className="hidden md:flex md:absolute md:bottom-24 md:left-1/2 md:-translate-x-1/2 z-[1050] gap-3">
          {map.showWaterPointsButton && !map.isLoadingWaterPoints && map.showWaterPoints && (
            <button
              onClick={() => {
                map.setIsLoadingWaterPoints(true);
                map.setShowWaterPointsButton(false);
                (window as any).__loadWaterPointsManually?.();
              }}
              className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg shadow-lg transition-all flex items-center gap-2 font-medium text-sm whitespace-nowrap"
              title="Rechercher les points d'eau"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                <path d="M16 16h5v5"/>
              </svg>
              Rechercher les points d'eau
            </button>
          )}
          {map.isLoadingWaterPoints && map.showWaterPoints && (
            <div className="px-4 py-2.5 bg-white rounded-lg shadow-lg flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-sky-600 animate-spin" />
              <span className="text-gray-700 text-sm font-medium">Chargement points d'eau...</span>
            </div>
          )}
          {map.showProtectedAreasButton && !map.isLoadingProtectedAreas && map.showProtectedAreas && (
            <button
              onClick={() => map.loadProtectedAreasForView()}
              className="px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg shadow-lg transition-all flex items-center gap-2 font-medium text-sm whitespace-nowrap"
              title="Rechercher les zones réglementées"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                <path d="M16 16h5v5"/>
              </svg>
              Rechercher les zones réglementées
            </button>
          )}
          {map.isLoadingProtectedAreas && map.showProtectedAreas && (
            <div className="px-4 py-2.5 bg-white rounded-lg shadow-lg flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-red-600 animate-spin" />
              <span className="text-gray-700 text-sm font-medium">Chargement des zones...</span>
            </div>
          )}
        </div>
      )}

      {/* Panels — each in its own Suspense so lazy loading never unmounts MapView */}
      {pois.selectedLocation && !anyDashboardActive && (
        <Suspense fallback={null}>
          <PoiDetailsPanel
            key={pois.selectedLocation.id}
            location={pois.selectedLocation}
            onClose={handleClosePanel}
            protectedAreas={map.allProtectedAreas}
            customZones={map.customZones}
            onSetDisabled={pois.setSpotDisabled}
            onLoginRequired={() => setShowLoginPanel(true)}
            onEdit={isAdmin ? handleOpenEditPanel : undefined}
          />
        </Suspense>
      )}

      {(selectedZone || selectedProtectedArea) && (
        <Suspense fallback={null}>
          <ZoneInfoPanel
            zone={selectedZone}
            protectedArea={selectedProtectedArea}
            onClose={handleCloseZoneInfo}
          />
        </Suspense>
      )}

      {isAddingMode && (
        <Suspense fallback={null}>
          <AddPoiPanel
            onClose={handleCloseAddPanel}
            onSubmit={handleSubmitPoi}
            selectedPosition={temporaryPosition}
            onSetPosition={setTemporaryPosition}
            customZones={map.customZones}
            protectedAreas={map.allProtectedAreas}
          />
        </Suspense>
      )}

      {editingPoi && (
        <Suspense fallback={null}>
          <AddPoiPanel
            mode="edit"
            initialPoi={editingPoi}
            onClose={() => setEditingPoi(null)}
            onSubmit={(updates) => handleUpdatePoi(editingPoi.id, updates)}
            selectedPosition={editingPoi.position}
            onSetPosition={() => {}}
            customZones={map.customZones}
            protectedAreas={map.allProtectedAreas}
          />
        </Suspense>
      )}

      {filters.isRoutingMode && (
        <Suspense fallback={null}>
          <RoutePanel
            onClose={filters.closeRoutePanel}
            isSmartRouting={filters.isSmartRouting}
            onToggleSmartRouting={filters.setIsSmartRouting}
            onClearRoute={filters.deactivateTrip}
            onFinishRoute={() => filters.setIsRoutingMode(false)}
            routePointsCount={filters.routePoints.length}
            nearbyPoisCount={filters.nearbyPoisCount}
            nearbyWaterCount={nearbyWaterCount}
            isLoadingWaterCount={isLoadingRouteWater}
            maxDistance={filters.maxDistanceFromRoute}
            onMaxDistanceChange={filters.setMaxDistanceFromRoute}
            onSaveRoute={handleSaveRoute}
          />
        </Suspense>
      )}

      {filters.showFilters && (
        <Suspense fallback={null}>
          <FilterPanel
            filters={filters.filters}
            onFilterChange={filters.setFilters}
            onClose={() => filters.setShowFilters(false)}
            trips={trips.trips}
            activeTripId={filters.activeTripId}
            onToggleTrip={handleToggleTrip}
            maxDistanceFromRoute={filters.maxDistanceFromRoute}
            onMaxDistanceChange={filters.setMaxDistanceFromRoute}
            nearbyPoisCount={filters.nearbyPoisCount}
            nearbyWaterCount={nearbyWaterCount}
            isLoadingWaterCount={isLoadingRouteWater}
          />
        </Suspense>
      )}

      {showDiagnostic && (
        <div className="fixed inset-0 z-[1000] bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="relative max-w-3xl w-full">
            <button
              onClick={() => setShowDiagnostic(false)}
              className="absolute -top-2 -right-2 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-colors z-10"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <Suspense fallback={null}><ServerStatus /></Suspense>
          </div>
        </div>
      )}

      {map.showWaterPointsInfo && (
        <Suspense fallback={null}>
          <WaterPointsInfo onClose={() => map.setShowWaterPointsInfo(false)} />
        </Suspense>
      )}

      <Toaster position="bottom-center" />

      {/* Mobile: controls toggle — bottom right (masqué quand le dashboard occupe tout l'écran) */}
      {/* Mobile bottom bar — © row + actions row */}
      {!anyDashboardActive && (
      <div className="md:hidden fixed bottom-0 inset-x-0 z-[600] flex flex-col">

        {/* Ligne add spot + chevron */}
        {!isAddingMode && !(selectedZone || selectedProtectedArea) && (
          <div className="flex items-center justify-between px-4 pb-1 pt-1 gap-3">

            {/* Gauche : espace symétrique */}
            <div className="w-12 flex-shrink-0" />

            {/* Centre : ajouter un spot */}
            <div className="flex-1 flex justify-center">
              {!filters.isRoutingMode && (
                <button
                  onClick={handleOpenAddPanel}
                  className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors shadow-lg"
                >
                  <Plus className="w-5 h-5" />
                  <span className="text-[15px]">Ajouter un spot</span>
                </button>
              )}
            </div>

            {/* Droite : refresh (flottent) + options (flottent) + chevron */}
            <div className="relative w-12 flex-shrink-0 flex flex-col items-end">
              <div className="absolute bottom-full right-0 mb-2 flex flex-col items-end gap-2">
                {/* Boutons refresh */}
                {map.showWaterPointsButton && !map.isLoadingWaterPoints && map.showWaterPoints && (
                  <button
                    onClick={() => {
                      map.setIsLoadingWaterPoints(true);
                      map.setShowWaterPointsButton(false);
                      (window as any).__loadWaterPointsManually?.();
                    }}
                    className="w-12 h-12 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white flex items-center justify-center shadow-lg transition-colors"
                    title="Rechercher les points d'eau"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                      <path d="M3 3v5h5"/>
                      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                      <path d="M16 16h5v5"/>
                    </svg>
                  </button>
                )}
                {map.isLoadingWaterPoints && map.showWaterPoints && (
                  <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-lg">
                    <Loader2 className="w-4 h-4 text-sky-600 animate-spin" />
                  </div>
                )}
                {map.showProtectedAreasButton && !map.isLoadingProtectedAreas && map.showProtectedAreas && (
                  <button
                    onClick={() => map.loadProtectedAreasForView()}
                    className="w-12 h-12 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center shadow-lg transition-colors"
                    title="Rechercher les zones réglementées"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                      <path d="M3 3v5h5"/>
                      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                      <path d="M16 16h5v5"/>
                    </svg>
                  </button>
                )}
                {map.isLoadingProtectedAreas && map.showProtectedAreas && (
                  <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-lg">
                    <Loader2 className="w-4 h-4 text-red-600 animate-spin" />
                  </div>
                )}
                {/* Panneau options */}
              {showMobileOptions && (
                <div className="bg-white rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
                  <button
                    onClick={map.toggleProtectedAreas}
                    className={`w-12 h-12 flex items-center justify-center transition-colors ${map.showProtectedAreas ? 'bg-red-50' : 'hover:bg-gray-50'}`}
                    title="Zones réglementées"
                  >
                    <BanIcon className={`w-5 h-5 ${map.showProtectedAreas ? 'text-red-600' : 'text-gray-600'}`} />
                  </button>
                  <button
                    onClick={map.toggleWaterPoints}
                    className={`w-12 h-12 flex items-center justify-center transition-colors ${map.showWaterPoints ? 'bg-sky-50' : 'hover:bg-gray-50'}`}
                    title="Points d'eau"
                  >
                    <Droplet className={`w-5 h-5 ${map.showWaterPoints ? 'text-sky-600' : 'text-gray-600'}`} />
                  </button>
                  <button
                    onClick={map.toggleWeather}
                    className={`w-12 h-12 flex items-center justify-center transition-colors ${map.showWeather ? 'bg-cyan-50' : 'hover:bg-gray-50'}`}
                    title="Météo (radar, foudre, vent, nivoses)"
                  >
                    <CloudRain className={`w-5 h-5 ${map.showWeather ? 'text-cyan-600' : 'text-gray-600'}`} />
                  </button>
                  <button
                    onClick={map.toggleSatellite}
                    className={`w-12 h-12 flex items-center justify-center transition-colors ${map.satelliteMode ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}
                    title={map.satelliteMode ? 'Vue topographique' : 'Vue satellite'}
                  >
                    <svg className={`w-5 h-5 ${map.satelliteMode ? 'text-emerald-700' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  <button
                    onClick={map.toggleWinter}
                    className={`w-12 h-12 flex items-center justify-center transition-colors ${map.winterMode ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    title={map.winterMode ? 'Désactiver le mode hiver' : 'Activer le mode hiver'}
                  >
                    <Snowflake className={`w-5 h-5 ${map.winterMode ? 'text-blue-600' : 'text-gray-600'}`} />
                  </button>
                  <div className="border-t border-gray-100">
                    <button
                      onClick={() => {
                        setShowMobileOptions(false);
                        if ('geolocation' in navigator) {
                          navigator.geolocation.getCurrentPosition(
                            ({ coords }) => {
                              setUserPosition({ lat: coords.latitude, lng: coords.longitude });
                              (window as any).__mapCenterTo?.(coords.latitude, coords.longitude);
                            },
                            () => toast.error('Impossible d\'accéder à votre position.')
                          );
                        } else {
                          toast.error('La géolocalisation n\'est pas supportée.');
                        }
                      }}
                      className="w-12 h-12 flex items-center justify-center hover:bg-gray-50 transition-colors"
                      title="Ma position"
                    >
                      <Locate className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                </div>
              )}
              </div>
              <button
                onClick={() => setShowMobileOptions(!showMobileOptions)}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors shadow-lg ${
                  showMobileOptions ? 'bg-gray-200 text-gray-700' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
                title={showMobileOptions ? 'Masquer les options' : 'Plus d\'options'}
              >
                {showMobileOptions ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
              </button>
            </div>
          </div>
        )}

        {/* Ligne © attribution — tout en bas */}
        <div className="flex items-center gap-2 px-4 pt-1 pb-2">
          <button
            onClick={() => setAttribOpen(o => !o)}
            className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-semibold shadow-md transition-colors ${
              attribOpen ? 'bg-gray-700 text-white' : 'bg-white/90 backdrop-blur-sm text-gray-600'
            }`}
            title="Sources cartographiques"
          >
            ©
          </button>
          {attribOpen && (
            <div className="flex-1 min-w-0 overflow-x-auto">
              <span className="inline-block text-[10px] text-gray-500 whitespace-nowrap bg-white/95 backdrop-blur-sm rounded-lg px-2.5 py-1.5 shadow-sm">
                {map.satelliteMode
                  ? 'Tiles © Esri'
                  : 'Map data: © OpenStreetMap contributors · Map style: © OpenTopoMap'}
                {' · Contours des massifs : © OpenStreetMap contributors (ODbL)'}
              </span>
            </div>
          )}
        </div>

      </div>
      )}

      {showLoginPanel && (
        <Suspense fallback={null}>
          <LoginPanel onClose={() => setShowLoginPanel(false)} />
        </Suspense>
      )}

      {dashboardActive && (
        <Suspense fallback={null}>
          <AdminDashboard
            onClose={() => setShowAdminDashboard(false)}
            locations={pois.locations}
            onViewOnMap={handleViewSpotOnMap}
            onSetDisabled={pois.setSpotDisabled}
            onDeleteSpot={pois.deleteSpot}
            onOpenZonesEditor={handleOpenZonesFromDashboard}
            onOpenTerritoryEditor={handleOpenTerritoryEditorFromDashboard}
            onRefetchPois={pois.refetchPois}
          />
        </Suspense>
      )}

      {userDashboardActive && (
        <Suspense fallback={null}>
          <UserDashboard
            onClose={() => setShowUserDashboard(false)}
            locations={pois.locations}
            onViewSpotOnMap={handleViewSpotOnMap}
            onDeleteSpot={pois.deleteSpot}
            onViewTripOnMap={handleViewTripOnMap}
          />
        </Suspense>
      )}

      {isAdmin && showCustomZonesEditor && (
        <Suspense fallback={null}>
        <CustomZonesEditor
          onClose={() => {
            setShowCustomZonesEditor(false);
            setIsDrawingMode(false);
            setDrawnGeometry(null);
            setEditingZone(null);
            setEditingOsmZone(null);
            setPreviewGeometry(null);
          }}
          drawnGeometry={drawnGeometry}
          editingZone={editingZone}
          editingOsmZone={editingOsmZone}
          onRegisterRequestClose={(fn) => { requestCloseZoneForm.current = fn; }}
          onPreviewGeometryChange={setPreviewGeometry}
        />
        </Suspense>
      )}

      {isSuperAdmin && showAdminZoneEditor && (
        <Suspense fallback={null}>
          <CustomZonesEditor
            mode="admin"
            onClose={handleCloseAdminZoneEditor}
            drawnGeometry={drawnGeometry}
            editingAdminZone={editingAdminZone}
            onRegisterRequestClose={(fn) => { requestCloseZoneForm.current = fn; }}
            onPreviewGeometryChange={setPreviewGeometry}
          />
        </Suspense>
      )}

    </div>
  );
}
