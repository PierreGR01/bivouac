import React, { useState, useEffect, useRef, Suspense } from 'react';
import { toast, Toaster } from 'sonner';
import { devLog } from './utils/logger';
import { MapView } from './components/MapView';
import { SearchBar } from './components/SearchBar';
import { FilterOptions } from './components/FilterPanel';
import { NewPoi } from './components/AddPoiPanel';
import { MOBILE_BREAKPOINT_PX } from './constants';
import { useAuth } from './contexts/AuthContext';
import { Tent, Plus, Loader2, AlertCircle, Settings, Search, BanIcon, Droplet, ChevronUp, ChevronDown, Snowflake, Locate, Lock } from 'lucide-react';
import { usePois } from './hooks/usePois';
import { useMapLayers } from './hooks/useMapLayers';
import { useFilters } from './hooks/useFilters';
import { CustomZone } from '../utils/supabase/custom-zones-api';
import { ProtectedArea } from './services/protected-areas';

const PoiDetailsPanel = React.lazy(() => import('./components/PoiDetailsPanel').then(m => ({ default: m.PoiDetailsPanel })));
const AddPoiPanel = React.lazy(() => import('./components/AddPoiPanel').then(m => ({ default: m.AddPoiPanel })));
const RoutePanel = React.lazy(() => import('./components/RoutePanel').then(m => ({ default: m.RoutePanel })));
const FilterPanel = React.lazy(() => import('./components/FilterPanel').then(m => ({ default: m.FilterPanel })));
const LoginPanel = React.lazy(() => import('./components/LoginPanel').then(m => ({ default: m.LoginPanel })));
const CustomZonesEditor = React.lazy(() => import('./components/CustomZonesEditor').then(m => ({ default: m.CustomZonesEditor })));
const ServerStatus = React.lazy(() => import('./components/ServerStatus').then(m => ({ default: m.ServerStatus })));
const WaterPointsInfo = React.lazy(() => import('./components/WaterPointsInfo').then(m => ({ default: m.WaterPointsInfo })));

export default function App() {
  const { currentUser, isAdmin } = useAuth();

  const pois = usePois();
  const map = useMapLayers();
  const filters = useFilters(pois.locations, map.winterMode);

  // UI mode state (stays in App — pure UI concerns)
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [temporaryPosition, setTemporaryPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [isMeasuringMode, setIsMeasuringMode] = useState(false);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawTool, setDrawTool] = useState<'polygon' | 'rectangle'>('polygon');
  const [drawnGeometry, setDrawnGeometry] = useState<GeoJSON.Feature | null>(null);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [showLoginPanel, setShowLoginPanel] = useState(false);
  const [showCustomZonesEditor, setShowCustomZonesEditor] = useState(false);
  const [editingZone, setEditingZone] = useState<CustomZone | null>(null);
  const [editingOsmZone, setEditingOsmZone] = useState<ProtectedArea | null>(null);
  const [showMobileOptions, setShowMobileOptions] = useState(false);
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);

  // --- Composed handlers ---

  const handleLocationClick = (location: typeof pois.selectedLocation) => {
    pois.setSelectedLocation(location);
    filters.setShowFilters(false);
  };

  const handleClosePanel = () => pois.setSelectedLocation(null);

  const handleOpenAddPanel = () => {
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
    }
  };

  const handleSubmitPoi = async (newPoi: NewPoi) => {
    await pois.submitPoi(newPoi, map.waterPoints, () => {
      setIsAddingMode(false);
      setTemporaryPosition(null);
    });
  };

  const handleToggleCustomZones = () => {
    if (showCustomZonesEditor) {
      setShowCustomZonesEditor(false);
      setIsDrawingMode(false);
      setEditingZone(null);
    } else {
      setShowCustomZonesEditor(true);
      setIsDrawingMode(true);
      setDrawTool('polygon');
    }
  };

  const handleZoneClick = (zone: CustomZone) => {
    if (!isAdmin) return;
    setEditingZone(zone);
    setEditingOsmZone(null);
    setShowCustomZonesEditor(true);
    setIsDrawingMode(false);
  };

  const handleOsmZoneClick = (area: ProtectedArea) => {
    if (!isAdmin) return;
    setEditingOsmZone(area);
    setEditingZone(null);
    setShowCustomZonesEditor(true);
    setIsDrawingMode(false);
  };

  const isPanelOpen =
    pois.selectedLocation !== null || isAddingMode || filters.showFilters || filters.isRoutingMode;

  return (
    <div className="relative h-screen w-screen overflow-hidden">

      {/* Search bar — hidden on mobile when a POI is selected */}
      <div className={pois.selectedLocation ? 'hidden md:block' : 'block'}>
        <SearchBar
          searchTerm={filters.searchTerm}
          onSearchChange={filters.setSearchTerm}
          onFilterClick={() => filters.setShowFilters(!filters.showFilters)}
          onAddSpotClick={handleOpenAddPanel}
          activeFiltersCount={filters.activeFiltersCount}
          isAddingMode={isAddingMode}
          isRoutingMode={filters.isRoutingMode}
          isPanelOpen={isPanelOpen}
          isAdmin={isAdmin}
          currentUser={currentUser}
          onLoginClick={() => setShowLoginPanel(!showLoginPanel)}
          onToggleZones={handleToggleCustomZones}
          showCustomZonesEditor={showCustomZonesEditor}
        />
      </div>

      {/* Top-right buttons — desktop only */}
      <div className="hidden md:flex absolute top-6 right-6 z-[600] items-center gap-3">
        {!pois.serverAvailable && !isAddingMode && (
          <button
            onClick={() => setShowDiagnostic(!showDiagnostic)}
            className="flex items-center gap-2 px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors shadow-lg"
            title="Diagnostic du serveur"
          >
            <Settings className="w-5 h-5" />
          </button>
        )}

        {isAdmin && (
          <button
            onClick={handleToggleCustomZones}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors shadow-lg ${
              showCustomZonesEditor
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
            }`}
            title="Créer une zone réglementée"
          >
            <Settings className="w-5 h-5" />
            <span className="text-sm font-medium">Zones</span>
          </button>
        )}

        <button
          onClick={() => setShowLoginPanel(!showLoginPanel)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors shadow-lg ${
            currentUser
              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
              : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
          }`}
          title={currentUser ? 'Profil' : 'Connexion'}
        >
          <Lock className="w-5 h-5" />
          {currentUser && <span className="text-sm font-medium">Admin</span>}
        </button>
      </div>

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
          drawTool={drawTool}
          onMapClick={handleMapClick}
          onGeometryDrawn={(geometry) => {
            setDrawnGeometry(geometry);
            setIsDrawingMode(false);
          }}
          temporaryMarkerPosition={temporaryPosition}
          routePoints={filters.routePoints}
          isSmartRouting={filters.isSmartRouting}
          showWaterPoints={map.showWaterPoints}
          showProtectedAreas={map.showProtectedAreas}
          protectedAreas={map.allProtectedAreas}
          customZones={map.customZones}
          onZoneClick={isAdmin ? handleZoneClick : undefined}
          onProtectedAreaClick={isAdmin ? handleOsmZoneClick : undefined}
          onMapMove={(bounds) => map.setMapBounds(bounds)}
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
        />
      </div>

      {/* Water/protected areas loading indicators */}
      {!isAddingMode && !(pois.selectedLocation && window.innerWidth < MOBILE_BREAKPOINT_PX) && (
        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-[1050] flex gap-3">
          {map.showWaterPointsButton && !map.isLoadingWaterPoints && map.showWaterPoints && (
            <button
              onClick={() => {
                map.setIsLoadingWaterPoints(true);
                map.setShowWaterPointsButton(false);
                (window as any).__loadWaterPointsManually?.();
              }}
              className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg shadow-lg transition-all flex items-center gap-2 font-medium text-sm"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                <path d="M16 16h5v5"/>
              </svg>
              <span>Rechercher les points d'eau</span>
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
              className="px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg shadow-lg transition-all flex items-center gap-2 font-medium text-sm"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                <path d="M16 16h5v5"/>
              </svg>
              <span>Rechercher les zones réglementées</span>
            </button>
          )}

          {map.isLoadingProtectedAreas && map.showProtectedAreas && (
            <div className="px-4 py-2.5 bg-white rounded-lg shadow-lg flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-red-600 animate-spin" />
                <span className="text-gray-700 text-sm font-medium">Chargement des zones...</span>
              </div>
              <span className="text-xs text-gray-500 pl-6">Cela peut prendre jusqu'à 1 minute</span>
            </div>
          )}
        </div>
      )}

      {/* Panels — each in its own Suspense so lazy loading never unmounts MapView */}
      {pois.selectedLocation && (
        <Suspense fallback={null}>
          <PoiDetailsPanel
            location={pois.selectedLocation}
            onClose={handleClosePanel}
            protectedAreas={map.allProtectedAreas}
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
          />
        </Suspense>
      )}

      {filters.isRoutingMode && (
        <Suspense fallback={null}>
          <RoutePanel
            onClose={filters.closeRoutePanel}
            isSmartRouting={filters.isSmartRouting}
            onToggleSmartRouting={filters.setIsSmartRouting}
            onClearRoute={() => filters.setRoutePoints([])}
            onFinishRoute={() => filters.setIsRoutingMode(false)}
            routePointsCount={filters.routePoints.length}
            nearbyPoisCount={filters.nearbyPoisCount}
            maxDistance={filters.maxDistanceFromRoute}
            onMaxDistanceChange={filters.setMaxDistanceFromRoute}
          />
        </Suspense>
      )}

      {filters.showFilters && (
        <Suspense fallback={null}>
          <FilterPanel
            filters={filters.filters}
            onFilterChange={filters.setFilters}
            onClose={() => filters.setShowFilters(false)}
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

      {/* Mobile: controls toggle — bottom right */}
      {!isAddingMode && (
        <div className="md:hidden fixed bottom-6 right-6 z-[600] flex flex-col items-end gap-2">
          {/* Expanded controls panel — icons only, compact */}
          {showMobileOptions && (
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
              <button
                onClick={map.toggleProtectedAreas}
                className={`w-12 h-12 flex items-center justify-center transition-colors ${
                  map.showProtectedAreas ? 'bg-red-50' : 'hover:bg-gray-50'
                }`}
                title="Zones réglementées"
              >
                <BanIcon className={`w-5 h-5 ${map.showProtectedAreas ? 'text-red-600' : 'text-gray-600'}`} />
              </button>

              <button
                onClick={map.toggleWaterPoints}
                className={`w-12 h-12 flex items-center justify-center transition-colors ${
                  map.showWaterPoints ? 'bg-sky-50' : 'hover:bg-gray-50'
                }`}
                title="Points d'eau"
              >
                <Droplet className={`w-5 h-5 ${map.showWaterPoints ? 'text-sky-600' : 'text-gray-600'}`} />
              </button>

              <button
                onClick={map.toggleSatellite}
                className={`w-12 h-12 flex items-center justify-center transition-colors ${
                  map.satelliteMode ? 'bg-emerald-50' : 'hover:bg-gray-50'
                }`}
                title={map.satelliteMode ? 'Vue topographique' : 'Vue satellite'}
              >
                <svg className={`w-5 h-5 ${map.satelliteMode ? 'text-emerald-700' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>

              <button
                onClick={map.toggleWinter}
                className={`w-12 h-12 flex items-center justify-center transition-colors ${
                  map.winterMode ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
                title={map.winterMode ? 'Désactiver le mode hiver' : 'Activer le mode hiver'}
              >
                <Snowflake className={`w-5 h-5 ${map.winterMode ? 'text-blue-600' : 'text-gray-600'}`} />
              </button>

              {isAdmin && (
                <button
                  onClick={() => { handleToggleCustomZones(); setShowMobileOptions(false); }}
                  className={`w-12 h-12 flex items-center justify-center transition-colors ${
                    showCustomZonesEditor ? 'bg-purple-50' : 'hover:bg-gray-50'
                  }`}
                  title="Zones custom"
                >
                  <Settings className={`w-5 h-5 ${showCustomZonesEditor ? 'text-purple-600' : 'text-gray-600'}`} />
                </button>
              )}

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

          {/* Toggle button — rounded square, desktop-panel style */}
          <button
            onClick={() => setShowMobileOptions(!showMobileOptions)}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors shadow-lg ${
              showMobileOptions
                ? 'bg-gray-200 text-gray-700'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
            title={showMobileOptions ? 'Masquer les options' : 'Plus d\'options'}
          >
            {showMobileOptions ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </button>
        </div>
      )}

      {/* Mobile: Add spot button — bottom center */}
      {!isAddingMode && !filters.isRoutingMode && (
        <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[600] pointer-events-auto">
          <button
            onClick={handleOpenAddPanel}
            className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors shadow-lg"
          >
            <Plus className="w-5 h-5" />
            <span className="text-[15px]">Ajouter un spot</span>
          </button>
        </div>
      )}

      {showLoginPanel && (
        <Suspense fallback={null}>
          <LoginPanel onClose={() => setShowLoginPanel(false)} />
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
          }}
          onDrawingToolChange={setDrawTool}
          drawnGeometry={drawnGeometry}
          editingZone={editingZone}
          editingOsmZone={editingOsmZone}
        />
        </Suspense>
      )}

    </div>
  );
}
