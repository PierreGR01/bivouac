import React, { useState, useEffect, useMemo, useRef } from 'react';
import { toast, Toaster } from 'sonner';
import { devLog } from './utils/logger';
import { MapView } from './components/MapView';
import { PoiDetailsPanel } from './components/PoiDetailsPanel';
import { AddPoiPanel, NewPoi } from './components/AddPoiPanel';
import { RoutePanel } from './components/RoutePanel';
import { ServerStatus } from './components/ServerStatus';
import { WaterPointsInfo } from './components/WaterPointsInfo';
import { SearchBar } from './components/SearchBar';
import { FilterPanel, FilterOptions } from './components/FilterPanel';
import { mockLocations } from './data';
import { PoiLocation } from './types';
import { Tent, Plus, Loader2, AlertCircle, Settings, Search, SlidersHorizontal, BanIcon, Droplet, Maximize, Minimize, ChevronUp, ChevronDown, Snowflake, Locate } from 'lucide-react';
import * as api from '/utils/supabase/api';
import { fetchAlpesProtectedAreas, ProtectedArea } from './services/protected-areas';
import { calculateWaterProximity } from './utils/water-proximity';
import { migratePois } from './utils/poi-migration';
import { fetchWaterPoints } from './services/overpass';

export default function App() {
  const [locations, setLocations] = useState<PoiLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<PoiLocation | null>(null);
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [temporaryPosition, setTemporaryPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [serverAvailable, setServerAvailable] = useState(true);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  
  // Ref pour éviter les doubles appels en React StrictMode
  const hasLoadedRef = useRef(false);

  // États pour la recherche et les filtres
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    seasons: [],
    waterProximity: []
  });

  // États pour le mode itinéraire
  const [isRoutingMode, setIsRoutingMode] = useState(false);
  const [routePoints, setRoutePoints] = useState<Array<{ lat: number; lng: number }>>([]);
  const [isSmartRouting, setIsSmartRouting] = useState(true);
  const [maxDistanceFromRoute, setMaxDistanceFromRoute] = useState(2); // en km

  // État pour le mode mesure
  const [isMeasuringMode, setIsMeasuringMode] = useState(false);

  // État pour la vue satellite (toggle)
  const [satelliteMode, setSatelliteMode] = useState(false);
  
  // État pour le mode hiver
  const [winterMode, setWinterMode] = useState(false);

  // État pour afficher les points d'eau OSM
  const [showWaterPoints, setShowWaterPoints] = useState(false);
  const [showWaterPointsInfo, setShowWaterPointsInfo] = useState(false);
  const [showWaterPointsButton, setShowWaterPointsButton] = useState(false);
  const [isLoadingWaterPoints, setIsLoadingWaterPoints] = useState(false);
  const [waterPoints, setWaterPoints] = useState<any[]>([]);

  // État pour afficher les zones protégées (Savoie/Isère/Haute-Alpes)
  const [showProtectedAreas, setShowProtectedAreas] = useState(false);
  const [allProtectedAreas, setAllProtectedAreas] = useState<any[]>([]);
  const [isLoadingProtectedAreas, setIsLoadingProtectedAreas] = useState(false);
  const [showMobileOptions, setShowMobileOptions] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Vérifier si le plein écran est supporté
  const fullscreenSupported = typeof document.documentElement.requestFullscreen === 'function' ||
    typeof (document.documentElement as any).webkitRequestFullscreen === 'function';

  // Activer le plein écran automatiquement sur mobile au premier chargement
  useEffect(() => {
    if (window.innerWidth < 768 && fullscreenSupported) {
      // Attendre un clic utilisateur pour activer le plein écran (requis par les navigateurs)
      const handleFirstClick = () => {
        const elem = document.documentElement;
        if (!document.fullscreenElement) {
          if (elem.requestFullscreen) {
            elem.requestFullscreen().catch(err => {
              devLog.log('Impossible d\'activer le plein écran:', err);
            });
          } else if ((elem as any).webkitRequestFullscreen) {
            (elem as any).webkitRequestFullscreen();
          }
        }
        document.removeEventListener('click', handleFirstClick);
      };
      document.addEventListener('click', handleFirstClick);
      
      return () => {
        document.removeEventListener('click', handleFirstClick);
      };
    }
  }, [fullscreenSupported]);

  // Détecter les changements de plein écran
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement || !!(document as any).webkitFullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Synchroniser le mode hiver avec les filtres de saison
  useEffect(() => {
    if (winterMode) {
      // Activer le filtre hiver s'il n'est pas déjà présent
      setFilters(prev => {
        if (!prev.seasons.includes('hiver')) {
          return {
            ...prev,
            seasons: ['hiver']
          };
        }
        return prev;
      });
    } else {
      // Désactiver le filtre hiver uniquement s'il était actif
      setFilters(prev => {
        if (prev.seasons.includes('hiver')) {
          return {
            ...prev,
            seasons: prev.seasons.filter(s => s !== 'hiver')
          };
        }
        return prev;
      });
    }
  }, [winterMode]);

  // Fonction pour basculer le plein écran
  const toggleFullscreen = () => {
    const elem = document.documentElement;
    const isCurrentlyFullscreen = document.fullscreenElement || (document as any).webkitFullscreenElement;
    
    if (!isCurrentlyFullscreen) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(err => {
          devLog.log('Impossible d\'activer le plein écran:', err);
          toast.error('Le plein écran n\'est pas supporté sur ce navigateur');
        });
      } else if ((elem as any).webkitRequestFullscreen) {
        (elem as any).webkitRequestFullscreen();
      } else {
        toast.error('Le plein écran n\'est pas supporté sur ce navigateur');
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
  };

  // Charger les POIs au démarrage
  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadPois();
    }
  }, []);

  // NOTE : Le reset automatique de la base de données a été désactivé pour éviter
  // les erreurs "broken pipe" côté serveur. Si vous devez réinitialiser la base,
  // utilisez la fonction resetPois() manuellement depuis la console :
  // await api.resetPois()

  // NOTE : Le préchargement automatique des zones protégées a été désactivé
  // pour éviter les timeouts serveur. Les utilisateurs peuvent charger les zones
  // manuellement via le bouton "Zones réglementées" sur la carte.

  // Les POIs se chargent automatiquement au démarrage avec gestion d'erreur gracieuse

  // Charger les POIs manuellement - fonction appelée par le bouton

  const loadPois = async () => {
    setIsLoading(true);
    try {
      const pois = await api.fetchPois();
      
      // Migrer les POIs pour supporter l'ancien format
      const migratedPois = migratePois(pois);
      
      // Utiliser les POIs du serveur (même si le tableau est vide)
      devLog.log(`✅ Chargé ${migratedPois.length} POI(s) depuis le serveur`);
      setLocations(migratedPois);
      setServerAvailable(true);
    } catch (error: any) {
      // Ignorer les erreurs d'annulation (abort)
      if (error?.name === 'AbortError') {
        devLog.log('ℹ️ Chargement des POIs annulé');
        return;
      }
      
      console.error('❌ Erreur lors du chargement des POIs:', error);
      // En cas d'erreur serveur, démarrer avec un tableau vide
      setLocations([]);
      setServerAvailable(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Charger les zones protégées pour la région Savoie/Isère/Haute-Alpes (une seule fois)
  const loadProtectedAreas = async () => {
    setIsLoadingProtectedAreas(true);

    devLog.log('🗻 Chargement des zones protégées (région Alpes)...');

    try {
      const areas = await fetchAlpesProtectedAreas();

      setAllProtectedAreas(areas);
      setShowProtectedAreas(true);

      if (areas.length === 0) {
        devLog.log('⚠️ Aucune zone protégée trouvée');
      } else {
        devLog.log(`✅ ${areas.length} zones protégées chargées (Alpes)`);
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des zones protégées:', error);
      setShowProtectedAreas(true);
    } finally {
      setIsLoadingProtectedAreas(false);
    }
  };


  const handleLocationClick = (location: PoiLocation) => {
    setSelectedLocation(location);
    setShowFilters(false);
    
    // Sur mobile, recentrer la carte sur le spot sélectionné
    if (window.innerWidth < 768) {
      // Délai pour laisser le temps à la carte de se mettre à jour
      setTimeout(() => {
        (window as any).__mapCenterOnLocation?.(location.position.lat, location.position.lng);
      }, 100);
    }
  };

  const handleClosePanel = () => {
    setSelectedLocation(null);
  };

  const handleOpenAddPanel = () => {
    setIsAddingMode(true);
    setSelectedLocation(null);
    setTemporaryPosition(null);
    setShowFilters(false);
  };

  const handleCloseAddPanel = () => {
    setIsAddingMode(false);
    setTemporaryPosition(null);
  };

  const handleOpenRoutePanel = () => {
    setIsRoutingMode(true);
    setSelectedLocation(null);
    setShowFilters(false);
    setIsAddingMode(false);
    setIsMeasuringMode(false);
    setRoutePoints([]);
  };

  const handleCloseRoutePanel = () => {
    setIsRoutingMode(false);
    setRoutePoints([]);
  };

  const handleClearRoute = () => {
    setRoutePoints([]);
  };

  const handleFinishRoute = () => {
    setIsRoutingMode(false);
    // Les points restent pour le filtrage
  };

  const handleToggleMeasureMode = () => {
    setIsMeasuringMode(!isMeasuringMode);
    setIsRoutingMode(false);
    setIsAddingMode(false);
    setSelectedLocation(null);
    setShowFilters(false);
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (isAddingMode) {
      setTemporaryPosition({ lat, lng });
    } else if (isRoutingMode) {
      setRoutePoints([...routePoints, { lat, lng }]);
    }
  };

  const handleSubmitPoi = async (newPoi: NewPoi) => {
    // Valider les coordonnées
    if (!newPoi.position ||
        typeof newPoi.position.lat !== 'number' ||
        typeof newPoi.position.lng !== 'number' ||
        isNaN(newPoi.position.lat) ||
        isNaN(newPoi.position.lng)) {
      toast.error('Coordonnées invalides. Cliquez sur la carte pour définir une position.');
      return;
    }

    setIsSaving(true);
    
    try {
      // Récupérer l'altitude automatiquement
      devLog.log('🏔️ Récupération de l\'altitude...');
      const altitude = await api.fetchAltitude(newPoi.position.lat, newPoi.position.lng);
      
      if (altitude !== null) {
        devLog.log(`✅ Altitude récupérée: ${altitude}m`);
      } else {
        console.warn('⚠️ Impossible de récupérer l\'altitude (les APIs sont peut-être lentes ou indisponibles)');
      }

      // Calculer la proximité de l'eau en utilisant les points d'eau disponibles
      let localWaterPoints = waterPoints;
      
      // Si aucun point d'eau n'est chargé, essayer d'en charger autour du nouveau spot
      if (waterPoints.length === 0) {
        devLog.log('🔍 Aucun point d\'eau chargé, tentative de chargement autour du nouveau spot...');
        
        // Créer un très petit bounding box de ~300m autour du point pour minimiser la charge
        const radius = 0.003; // ~300m en degrés (zone minimale pour éviter la surcharge de l'API)
        const bounds = {
          south: newPoi.position.lat - radius,
          west: newPoi.position.lng - radius,
          north: newPoi.position.lat + radius,
          east: newPoi.position.lng + radius,
        };
        
        try {
          // Charger les points d'eau autour du nouveau spot avec un timeout court
          localWaterPoints = await fetchWaterPoints(bounds, 15); // timeout réduit à 15s
          devLog.log(`✅ ${localWaterPoints.length} points d'eau trouvés pour le calcul de proximité`);
        } catch (error: any) {
          console.warn('⚠️ Impossible de charger les points d\'eau:', error?.message || error);
          // En cas d'erreur, continuer sans points d'eau
          // L'utilisateur peut toujours afficher les points d'eau manuellement après
        }
      } else {
        devLog.log(`💧 Utilisation des ${waterPoints.length} points d'eau déjà chargés pour le calcul de proximité`);
      }

      // Calculer la proximité de l'eau avec les points chargés
      const waterProximity = calculateWaterProximity(
        newPoi.position.lat,
        newPoi.position.lng,
        localWaterPoints
      );

      devLog.log(`💧 Proximité de l'eau calculée: ${waterProximity || 'aucun point d\'eau à proximité'}`);

      const poiWithId: PoiLocation = {
        id: `poi-${Date.now()}`,
        ...newPoi,
        waterProximity,
        altitude
      };
      
      // Essayer de sauvegarder sur le serveur
      const success = await api.createPoi(poiWithId);
      
      // Ajouter localement dans tous les cas
      setLocations([...locations, poiWithId]);
      setIsAddingMode(false);
      setTemporaryPosition(null);
      
      // Afficher le nouveau point
      setSelectedLocation(poiWithId);
      
      if (success) {
        setServerAvailable(true);
        toast.success('Point de bivouac enregistré ! Il est maintenant accessible à tous.');
      } else {
        setServerAvailable(false);
        toast.warning('Point ajouté localement. Le serveur n\'est pas disponible.');
      }
    } catch (error) {
      console.error('Error submitting POI:', error);
      
      // En cas d'erreur, créer le POI sans proximité d'eau
      const poiWithId: PoiLocation = {
        id: `poi-${Date.now()}`,
        ...newPoi,
        waterProximity: null,
      };
      
      // Ajouter localement même si l'enregistrement serveur échoue
      setLocations([...locations, poiWithId]);
      setIsAddingMode(false);
      setTemporaryPosition(null);
      setSelectedLocation(poiWithId);
      setServerAvailable(false);

      toast.error('Point ajouté localement. Le serveur n\'est pas disponible.');
    } finally {
      setIsSaving(false);
    }
  };

  // Fonction pour calculer la distance d'un point à un segment de ligne
  const distanceToSegment = (point: { lat: number; lng: number }, start: { lat: number; lng: number }, end: { lat: number; lng: number }): number => {
    const R = 6371; // Rayon de la Terre en km
    
    // Convertir en radians
    const lat1 = start.lat * Math.PI / 180;
    const lng1 = start.lng * Math.PI / 180;
    const lat2 = end.lat * Math.PI / 180;
    const lng2 = end.lng * Math.PI / 180;
    const latP = point.lat * Math.PI / 180;
    const lngP = point.lng * Math.PI / 180;
    
    // Calculer la distance du point aux extrémités du segment
    const distToStart = R * Math.acos(
      Math.sin(lat1) * Math.sin(latP) + 
      Math.cos(lat1) * Math.cos(latP) * Math.cos(lngP - lng1)
    );
    const distToEnd = R * Math.acos(
      Math.sin(lat2) * Math.sin(latP) + 
      Math.cos(lat2) * Math.cos(latP) * Math.cos(lngP - lng2)
    );
    
    // Si le segment est très court, retourner la distance minimale aux extrémités
    const segmentLength = R * Math.acos(
      Math.sin(lat1) * Math.sin(lat2) + 
      Math.cos(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1)
    );
    
    if (segmentLength < 0.001) {
      return Math.min(distToStart, distToEnd);
    }
    
    // Calculer la projection du point sur le segment
    const u = ((latP - lat1) * (lat2 - lat1) + (lngP - lng1) * (lng2 - lng1)) / 
              ((lat2 - lat1) ** 2 + (lng2 - lng1) ** 2);
    
    // Si la projection est en dehors du segment, retourner la distance minimale aux extrémités
    if (u < 0) return distToStart;
    if (u > 1) return distToEnd;
    
    // Calculer le point projeté
    const projLat = lat1 + u * (lat2 - lat1);
    const projLng = lng1 + u * (lng2 - lng1);
    
    // Distance du point au point projeté
    return R * Math.acos(
      Math.sin(latP) * Math.sin(projLat) + 
      Math.cos(latP) * Math.cos(projLat) * Math.cos(projLng - lngP)
    );
  };

  // Fonction pour calculer la distance minimale d'un point à un itinéraire
  const distanceToRoute = (point: { lat: number; lng: number }, route: Array<{ lat: number; lng: number }>): number => {
    if (route.length < 2) return Infinity;
    
    let minDistance = Infinity;
    for (let i = 0; i < route.length - 1; i++) {
      const dist = distanceToSegment(point, route[i], route[i + 1]);
      minDistance = Math.min(minDistance, dist);
    }
    
    return minDistance;
  };

  // Filtrer les locations selon la recherche et les filtres
  const filteredLocations = useMemo(() => {
    return locations.filter(location => {
      // Filtre de recherche par titre
      const matchesSearch = location.title.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Filtre par saison : si aucun ou les deux sélectionnés = afficher tous
      const matchesSeason = filters.seasons.length === 0 || 
                            filters.seasons.length === 2 || 
                            filters.seasons.includes(location.season);
      
      // Filtre par point d'eau : si aucun ou les deux sélectionnés = afficher tous
      let matchesWater = true;
      if (filters.waterProximity.length > 0 && filters.waterProximity.length < 2) {
        if (filters.waterProximity.includes('close')) {
          // Uniquement spots avec eau proche (< 100m)
          matchesWater = location.waterProximity === 'proche';
        } else if (filters.waterProximity.includes('distant')) {
          // Uniquement spots avec eau éloignée (100-200m)
          matchesWater = location.waterProximity === 'éloigné';
        }
      }
      // Si les deux sont sélectionnés ou aucun, on affiche tous (matchesWater reste true)
      
      // Filtre par itinéraire
      let matchesRoute = true;
      if (routePoints.length >= 2) {
        const distance = distanceToRoute(location.position, routePoints);
        matchesRoute = distance <= maxDistanceFromRoute;
      }
      
      return matchesSearch && matchesSeason && matchesWater && matchesRoute;
    });
  }, [locations, searchTerm, filters, routePoints, maxDistanceFromRoute]);

  const isPanelOpen = selectedLocation !== null || isAddingMode || showFilters || isRoutingMode;

  // Compter les filtres actifs
  const activeFiltersCount = 
    (filters.seasons.length > 0 && filters.seasons.length < 2 ? 1 : 0) + 
    (filters.waterProximity.length > 0 && filters.waterProximity.length < 2 ? 1 : 0) + 
    (routePoints.length >= 2 ? 1 : 0);

  // Compter les POIs à proximité de l'itinéraire
  const nearbyPoisCount = useMemo(() => {
    if (routePoints.length < 2) return 0;
    return locations.filter(location => {
      const distance = distanceToRoute(location.position, routePoints);
      return distance <= maxDistanceFromRoute;
    }).length;
  }, [locations, routePoints, maxDistanceFromRoute]);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Barre de recherche et filtres en haut à gauche - masquée en mode ajout sur mobile ET masquée sur mobile quand un spot est sélectionné */}
      <div className={selectedLocation ? 'hidden md:block' : 'block'}>
        {!isAddingMode && (
          <SearchBar 
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onFilterClick={() => setShowFilters(!showFilters)}
            onAddSpotClick={handleOpenAddPanel}
            activeFiltersCount={activeFiltersCount}
            isAddingMode={isAddingMode}
            isRoutingMode={isRoutingMode}
            isPanelOpen={isPanelOpen}
          />
        )}
      </div>

      {/* Bouton de diagnostic en haut à droite (si serveur non disponible) - masqué en mode ajout sur mobile */}
      {!serverAvailable && !isAddingMode && (
        <button
          onClick={() => setShowDiagnostic(!showDiagnostic)}
          className="absolute top-6 right-6 z-[600] flex items-center gap-2 px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors shadow-lg"
          title="Diagnostic du serveur"
        >
          <Settings className="w-5 h-5" />
        </button>
      )}

      {/* Indicateur de chargement */}
      {isLoading && (
        <div className="absolute inset-0 z-[600] backdrop-blur-sm flex items-center justify-center">
          <div className="text-center bg-white rounded-2xl shadow-2xl p-8 max-w-md mx-4">
            <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-700 font-medium">Chargement des points de bivouac...</p>
          </div>
        </div>
      )}

      {/* Message aucun résultat - masqué en mode ajout */}
      {!isLoading && filteredLocations.length === 0 && !isAddingMode && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[500] bg-white rounded-xl shadow-lg p-6 text-center max-w-sm">
          <div className="text-gray-400 mb-3">
            <Search className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun spot trouvé</h3>
          <p className="text-sm text-gray-600 mb-4">
            {searchTerm || activeFiltersCount > 0 
              ? "Essayez de modifier vos critères de recherche ou de filtres."
              : "Aucun spot de bivouac disponible pour le moment."}
          </p>
          {(searchTerm || activeFiltersCount > 0) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilters({ seasons: [], waterProximity: 'all' });
                setRoutePoints([]);
              }}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Réinitialiser
            </button>
          )}
        </div>
      )}

      {/* Notification serveur non disponible - masquée en mode ajout sur mobile */}
      {!serverAvailable && !isLoading && !isAddingMode && (
        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-[500] bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg shadow-lg max-w-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-yellow-800 font-medium">Le serveur Edge Function n'est pas accessible</p>
              <p className="text-xs text-yellow-700 mt-1">
                L'Edge Function Supabase doit être déployée pour que les points soient partagés.
              </p>
              <button
                onClick={() => setShowDiagnostic(true)}
                className="mt-2 text-xs text-yellow-800 underline hover:text-yellow-900"
              >
                Afficher le diagnostic →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Indicateur de sauvegarde */}
      {isSaving && (
        <div className="absolute inset-0 z-[1100] bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 shadow-2xl text-center">
            <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-700 font-medium">Enregistrement en cours...</p>
          </div>
        </div>
      )}

      {/* Carte en plein écran */}
      <div className="h-full w-full">
        <MapView 
          locations={filteredLocations} 
          onLocationClick={handleLocationClick}
          selectedLocation={selectedLocation}
          isAddingMode={isAddingMode}
          isRoutingMode={isRoutingMode}
          isMeasuringMode={isMeasuringMode}
          onMapClick={handleMapClick}
          temporaryMarkerPosition={temporaryPosition}
          routePoints={routePoints}
          isSmartRouting={isSmartRouting}
          showWaterPoints={showWaterPoints}
          showProtectedAreas={showProtectedAreas}
          protectedAreas={allProtectedAreas}
          satelliteMode={satelliteMode}
          onSatelliteModeToggle={() => {
            setSatelliteMode(!satelliteMode);
            if (!satelliteMode) setWinterMode(false); // Désactiver le mode hiver si on active satellite
          }}
          winterMode={winterMode}
          onWinterModeToggle={() => {
            setWinterMode(!winterMode);
            if (!winterMode) setSatelliteMode(false); // Désactiver satellite si on active hiver
          }}
          onWaterStateChange={({ isLoading, showButton }) => {
            setIsLoadingWaterPoints(isLoading);
            setShowWaterPointsButton(showButton && showWaterPoints);
          }}
          onWaterPointsLoaded={(points) => {
            setWaterPoints(points);
          }}
          onWaterPointsToggle={() => {
            const newState = !showWaterPoints;
            setShowWaterPoints(newState);
            if (!newState) {
              setShowWaterPointsButton(false);
            }
          }}
          onProtectedAreasToggle={() => {
            const newState = !showProtectedAreas;
            if (newState) {
              setShowProtectedAreas(true);
              loadProtectedAreas();
            } else {
              setShowProtectedAreas(false);
            }
          }}
          onRouteClick={handleOpenRoutePanel}
          onMeasureClick={handleToggleMeasureMode}
        />
      </div>

      {/* Boutons de recherche (points d'eau + zones protégées) côte à côte - masqués en mode ajout et quand une fiche est ouverte sur mobile */}
      {!isAddingMode && !(selectedLocation && window.innerWidth < 768) && (
        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-[1050] flex gap-3">
          {/* Bouton pour charger/recharger les points d'eau */}
          {showWaterPointsButton && !isLoadingWaterPoints && showWaterPoints && (
          <button
            onClick={() => {
              setIsLoadingWaterPoints(true);
              setShowWaterPointsButton(false);
              (window as any).__loadWaterPointsManually?.();
            }}
            className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg shadow-lg transition-all flex items-center gap-2 font-medium text-sm"
          >
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
              <path d="M16 16h5v5"/>
            </svg>
            <span>Rechercher les points d'eau</span>
          </button>
        )}

        {/* Indicateur de chargement des points d'eau */}
        {isLoadingWaterPoints && showWaterPoints && (
          <div className="px-4 py-2.5 bg-white rounded-lg shadow-lg flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-sky-600 animate-spin" />
            <span className="text-gray-700 text-sm font-medium">Chargement points d'eau...</span>
          </div>
        )}
        

        {/* Indicateur de chargement des zones protégées */}
        {isLoadingProtectedAreas && showProtectedAreas && (
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

      {/* Panneau de détails */}
      {selectedLocation && (
        <PoiDetailsPanel 
          location={selectedLocation}
          onClose={handleClosePanel}
          protectedAreas={allProtectedAreas}
        />
      )}

      {/* Panneau d'ajout */}
      {isAddingMode && (
        <AddPoiPanel
          onClose={handleCloseAddPanel}
          onSubmit={handleSubmitPoi}
          selectedPosition={temporaryPosition}
          onSetPosition={setTemporaryPosition}
        />
      )}

      {/* Panneau d'itinéraire */}
      {isRoutingMode && (
        <RoutePanel
          onClose={handleCloseRoutePanel}
          isSmartRouting={isSmartRouting}
          onToggleSmartRouting={setIsSmartRouting}
          onClearRoute={handleClearRoute}
          onFinishRoute={handleFinishRoute}
          routePointsCount={routePoints.length}
          nearbyPoisCount={nearbyPoisCount}
          maxDistance={maxDistanceFromRoute}
          onMaxDistanceChange={setMaxDistanceFromRoute}
        />
      )}

      {/* Panneau de filtres */}
      {showFilters && (
        <FilterPanel
          filters={filters}
          onFilterChange={setFilters}
          onClose={() => setShowFilters(false)}
        />
      )}

      {/* Panneau de diagnostic */}
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
            <ServerStatus />
          </div>
        </div>
      )}

      {/* Info Points d'eau */}
      {showWaterPointsInfo && (
        <WaterPointsInfo onClose={() => setShowWaterPointsInfo(false)} />
      )}

      {/* Toaster pour les notifications */}
      <Toaster position="bottom-center" />

      {/* Boutons flottants mobile en bas à droite - masqués en mode ajout */}
      {!isAddingMode && (
        <div className="md:hidden fixed bottom-11 right-6 z-[600] flex flex-col gap-3">
          {/* Menu déroulant avec les options */}
          <div className="flex flex-col gap-3 items-end">
            {/* Options qui apparaissent quand le menu est ouvert */}
            {showMobileOptions && (
              <div className="flex flex-col gap-3 animate-in slide-in-from-bottom-2 duration-200">
                {/* Zones réglementées */}
                <button
                  onClick={() => {
                    const newState = !showProtectedAreas;
                    if (newState && allProtectedAreas.length === 0) {
                      loadProtectedAreas();
                    } else {
                      setShowProtectedAreas(newState);
                    }
                  }}
                  className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-colors ${
                    showProtectedAreas
                      ? 'bg-red-600 text-white'
                      : 'bg-white text-gray-800 hover:bg-gray-50'
                  }`}
                  title="Zones réglementées"
                >
                  <BanIcon className="w-6 h-6" />
                </button>

                {/* Points d'eau */}
                <button
                  onClick={() => {
                    const newState = !showWaterPoints;
                    setShowWaterPoints(newState);
                    if (!newState) {
                      setShowWaterPointsButton(false);
                    }
                  }}
                  className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-colors ${
                    showWaterPoints 
                      ? 'bg-sky-600 text-white' 
                      : 'bg-white text-gray-800 hover:bg-gray-50'
                  }`}
                  title="Points d'eau"
                >
                  <Droplet className="w-6 h-6" />
                </button>

                {/* Vue Satellite */}
                <button
                  onClick={() => {
                    setSatelliteMode(!satelliteMode);
                    if (!satelliteMode) setWinterMode(false); // Désactiver le mode hiver si on active satellite
                  }}
                  className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-colors ${
                    satelliteMode 
                      ? 'bg-emerald-700 text-white' 
                      : 'bg-white text-gray-800 hover:bg-gray-50'
                  }`}
                  title={satelliteMode ? 'Vue topographique' : 'Vue satellite'}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>

                {/* Mode Hiver */}
                <button
                  onClick={() => {
                    setWinterMode(!winterMode);
                    if (!winterMode) setSatelliteMode(false); // Désactiver satellite si on active hiver
                  }}
                  className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-colors ${
                    winterMode 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-white text-gray-800 hover:bg-gray-50'
                  }`}
                  title={winterMode ? 'Désactiver le mode hiver' : 'Activer le mode hiver'}
                >
                  <Snowflake className="w-6 h-6" />
                </button>
                
                {/* Localisation */}
                <button
                  onClick={() => {
                    if ('geolocation' in navigator) {
                      navigator.geolocation.getCurrentPosition(
                        (position) => {
                          const { latitude, longitude } = position.coords;
                          (window as any).__mapCenterTo?.(latitude, longitude);
                        },
                        (error) => {
                          console.error('Erreur de géolocalisation:', error);
                          toast.error('Impossible d\'accéder à votre position.');
                        }
                      );
                    } else {
                      toast.error('La géolocalisation n\'est pas supportée.');
                    }
                  }}
                  className="w-14 h-14 bg-white rounded-full shadow-xl flex items-center justify-center hover:bg-gray-50 transition-colors"
                  title="Ma position"
                >
                  <Locate className="w-6 h-6 text-gray-800" />
                </button>
                
                {/* Filtres */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="relative w-14 h-14 bg-white rounded-full shadow-xl flex items-center justify-center hover:bg-gray-50 transition-colors"
                  title="Filtres"
                >
                  <SlidersHorizontal className="w-6 h-6 text-gray-800" />
                  {activeFiltersCount > 0 && (
                    <div className="absolute -top-1 -right-1 bg-emerald-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-md">
                      {activeFiltersCount}
                    </div>
                  )}
                </button>
              </div>
            )}

            {/* Bouton pour ouvrir/fermer le menu d'options */}
            <button
              onClick={() => setShowMobileOptions(!showMobileOptions)}
              className="w-14 h-14 bg-gray-800 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-gray-700 transition-colors"
              title={showMobileOptions ? "Masquer les options" : "Plus d'options"}
            >
              {showMobileOptions ? (
                <ChevronDown className="w-6 h-6" />
              ) : (
                <ChevronUp className="w-6 h-6" />
              )}
            </button>
          </div>

          {/* Bouton Plein écran - uniquement si supporté */}
          {fullscreenSupported && (
            <button
              onClick={toggleFullscreen}
              className="w-14 h-14 bg-white rounded-full shadow-xl flex items-center justify-center hover:bg-gray-50 transition-colors"
              title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
            >
              {isFullscreen ? (
                <Minimize className="w-6 h-6 text-gray-800" />
              ) : (
                <Maximize className="w-6 h-6 text-gray-800" />
              )}
            </button>
          )}

          {/* Bouton Ajouter un spot */}
          {!isRoutingMode && (
            <button
              onClick={handleOpenAddPanel}
              className="w-14 h-14 bg-emerald-600 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-emerald-700 transition-colors"
              title="Ajouter un spot"
            >
              <Plus className="w-6 h-6" />
            </button>
          )}
        </div>
      )}

    </div>
  );
}