import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { Trash2 } from 'lucide-react';
import { PoiLocation } from '../types';
import { fetchWaterPoints, WaterPoint, isDrinkable, getWaterPointLabel, getWaterPointInfo, RateLimitError, filterAndSortWaterPoints } from '../services/overpass';
import { ProtectedArea, getProtectedAreaLabel, getProtectedAreaInfo, shouldDisplayOnMap } from '../services/protected-areas';
import { MapControls } from './MapControls';

interface MapViewProps {
  locations: PoiLocation[];
  onLocationClick: (location: PoiLocation) => void;
  selectedLocation: PoiLocation | null;
  isAddingMode?: boolean;
  isRoutingMode?: boolean;
  isMeasuringMode?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  temporaryMarkerPosition?: { lat: number; lng: number } | null;
  routePoints?: Array<{ lat: number; lng: number }>;
  isSmartRouting?: boolean;
  showWaterPoints?: boolean;
  showProtectedAreas?: boolean;
  protectedAreas?: ProtectedArea[];
  onMapMove?: (bounds: any) => void;
  onWaterPointsToggle?: () => void;
  onProtectedAreasToggle?: () => void;
  onRouteClick?: () => void;
  onMeasureClick?: () => void;
  onWaterStateChange?: (state: { isLoading: boolean; showButton: boolean }) => void;
  onWaterPointsLoaded?: (points: WaterPoint[]) => void;
  satelliteMode?: boolean;
  onSatelliteModeToggle?: () => void;
  winterMode?: boolean;
  onWinterModeToggle?: () => void;
}

export function MapView({ 
  locations, 
  onLocationClick, 
  selectedLocation,
  isAddingMode = false,
  isRoutingMode = false,
  isMeasuringMode = false,
  onMapClick,
  temporaryMarkerPosition,
  routePoints = [],
  isSmartRouting = true,
  showWaterPoints = false,
  showProtectedAreas = false,
  protectedAreas = [],
  onMapMove,
  onWaterPointsToggle,
  onProtectedAreasToggle,
  onRouteClick,
  onMeasureClick,
  onWaterStateChange,
  onWaterPointsLoaded,
  satelliteMode = false,
  onSatelliteModeToggle,
  winterMode = false,
  onWinterModeToggle
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const temporaryMarkerRef = useRef<L.Marker | null>(null);
  const routeMarkersRef = useRef<L.Marker[]>([]);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const waterMarkersRef = useRef<L.Marker[]>([]);
  const protectedAreasLayersRef = useRef<L.Polygon[]>([]);
  const measureLineRef = useRef<L.Polyline | null>(null);
  const measureMarkerRef = useRef<L.Marker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const slopesLayerRef = useRef<L.TileLayer | null>(null);
  
  const [waterPoints, setWaterPoints] = useState<WaterPoint[]>([]);
  const [isLoadingWater, setIsLoadingWater] = useState(false);
  const [waterError, setWaterError] = useState<string | null>(null);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [showRefreshButton, setShowRefreshButton] = useState(false);
  const [isManualLoad, setIsManualLoad] = useState(false);
  
  // États pour l'outil de mesure
  const [measureStartPoint, setMeasureStartPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [measureDistance, setMeasureDistance] = useState<number | null>(null);
  const [currentMousePos, setCurrentMousePos] = useState<{ lat: number; lng: number } | null>(null);
  const [mapMoveCounter, setMapMoveCounter] = useState(0); // Pour forcer le re-render du panneau de mesure

  // Initialiser la carte
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Créer la carte sans contrôles de zoom (gérés manuellement)
    // Centrer sur Grenoble: 45.188529, 5.724524
    const map = L.map(mapRef.current, {
      zoomControl: false // Désactiver le contrôle par défaut
    }).setView([45.188529, 5.724524], 12);

    // Ajouter les tuiles avec fond topographique
    const tileLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: 'Map data: &copy; OpenStreetMap contributors | Map style: &copy; OpenTopoMap',
      maxZoom: 17
    }).addTo(map);
    
    tileLayerRef.current = tileLayer;
    mapInstanceRef.current = map;
    
    // Exposer les fonctions de zoom pour les contrôles personnalisés
    (window as any).__mapZoomIn = () => map.zoomIn();
    (window as any).__mapZoomOut = () => map.zoomOut();
    
    // Helper: Animation using flyTo (Leaflet's optimized movement method)
    const animateMapLinear = (targetLat: number, targetLng: number, targetZoom: number) => {
      // Use Leaflet's flyTo which is optimized for animated movement
      // duration is in seconds
      map.flyTo([targetLat, targetLng], targetZoom, {
        duration: 0.5
      });
    };

    // Exposer la fonction de recentrage pour les clics sur les spots
    (window as any).__mapCenterOnLocation = (lat: number, lng: number) => {
      const isMobile = window.innerWidth < 768;
      const zoom = map.getZoom();

      if (!isMobile) {
        // Desktop: fast animation
        animateMapLinear(lat, lng, zoom);
      } else {
        // Mobile: use fixed latitude offset to push spot up above content panel
        const latOffset = 0.05; // Offset in degrees
        animateMapLinear(lat - latOffset, lng, zoom);
      }
    };

    // Exposer la fonction pour centrer la carte sur les coordonnées (géolocalisation)
    (window as any).__mapCenterTo = (lat: number, lng: number) => {
      const isMobile = window.innerWidth < 768;
      const zoom = 14;

      if (!isMobile) {
        // Desktop: fast animation
        animateMapLinear(lat, lng, zoom);
      } else {
        // Mobile: use fixed latitude offset to push spot up above content panel
        const latOffset = 0.05; // Offset in degrees
        animateMapLinear(lat - latOffset, lng, zoom);
      }
    };

    // Notifier les bounds initiaux
    if (onMapMove) {
      const bounds = map.getBounds();
      onMapMove({
        south: bounds.getSouth(),
        north: bounds.getNorth(),
        west: bounds.getWest(),
        east: bounds.getEast()
      });
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
      delete (window as any).__mapZoomIn;
      delete (window as any).__mapZoomOut;
      delete (window as any).__mapCenterOnLocation;
      delete (window as any).__mapCenterTo;
    };
  }, []);

  // Gérer le changement de type de carte (topo/satellite/winter)
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;

    const map = mapInstanceRef.current;
    
    // Retirer l'ancien layer
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    // Créer un pane personnalisé pour le fond de carte si nécessaire
    if (!map.getPane('baseMapPane')) {
      const basePane = map.createPane('baseMapPane');
      basePane.style.zIndex = '200'; // Sous les autres couches
    }

    // Ajouter le nouveau layer selon le mode actif (satellite ou hiver ou normal)
    let newLayer: L.TileLayer;
    const basePane = map.getPane('baseMapPane');
    
    if (winterMode) {
      // Mode hiver : Fond topographique avec rendu adapté pour l'hiver
      // On utilise OpenTopoMap car il montre bien le relief, essentiel pour les activités hivernales
      newLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data: &copy; OpenStreetMap contributors | Map style: &copy; OpenTopoMap',
        maxZoom: 17,
        pane: 'baseMapPane'
      }).addTo(map);
      
      // Appliquer un filtre bleu subtil sur le pane du fond de carte uniquement
      if (basePane) {
        basePane.style.filter = 'sepia(0.05) saturate(1.1) hue-rotate(180deg) brightness(1)';
        basePane.style.opacity = '0.9';
      }
    } else if (satelliteMode) {
      // Mode satellite
      newLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 19,
        pane: 'baseMapPane'
      }).addTo(map);
      
      // Retirer le filtre si on n'est pas en mode hiver
      if (basePane) {
        basePane.style.filter = '';
        basePane.style.opacity = '';
      }
    } else {
      // Mode normal : vue topographique par défaut
      newLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data: &copy; OpenStreetMap contributors | Map style: &copy; OpenTopoMap',
        maxZoom: 17,
        pane: 'baseMapPane'
      }).addTo(map);
      
      // Retirer le filtre si on n'est pas en mode hiver
      if (basePane) {
        basePane.style.filter = '';
        basePane.style.opacity = '';
      }
    }
    
    tileLayerRef.current = newLayer;
  }, [satelliteMode, winterMode]);

  // Gérer l'affichage de la couche des pentes IGN en mode hiver
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    if (winterMode) {
      // Créer un pane pour la couche des pentes si nécessaire (au-dessus du fond de carte)
      if (!map.getPane('slopesPane')) {
        const slopesPane = map.createPane('slopesPane');
        slopesPane.style.zIndex = '300'; // Au-dessus du baseMapPane (200) mais sous les overlays (400)
      }

      // Ajouter la couche des pentes si elle n'existe pas
      if (!slopesLayerRef.current) {
        const slopesLayer = L.tileLayer('https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.SLOPES.MOUNTAIN&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}', {
          attribution: 'Carte des pentes &copy; IGN',
          maxZoom: 18,
          opacity: 0.6,
          pane: 'slopesPane'
        }).addTo(map);
        slopesLayerRef.current = slopesLayer;
      }
    } else {
      // Retirer la couche des pentes si elle existe
      if (slopesLayerRef.current) {
        map.removeLayer(slopesLayerRef.current);
        slopesLayerRef.current = null;
      }
    }
  }, [winterMode]);

  // Gérer le clic sur la carte en mode ajout, routage ou mesure
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (isMeasuringMode) {
        // Mode mesure
        if (!measureStartPoint) {
          // Premier clic : définir le point de départ
          setMeasureStartPoint({ lat: e.latlng.lat, lng: e.latlng.lng });
        } else {
          // Deuxième clic : finaliser la mesure
          const distance = calculateDistance(
            measureStartPoint.lat,
            measureStartPoint.lng,
            e.latlng.lat,
            e.latlng.lng
          );
          setMeasureDistance(distance);
          // La mesure reste active jusqu'à suppression manuelle
        }
      } else if ((isAddingMode || isRoutingMode) && onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    };

    mapInstanceRef.current.on('click', handleMapClick);

    return () => {
      mapInstanceRef.current?.off('click', handleMapClick);
    };
  }, [isAddingMode, isRoutingMode, isMeasuringMode, onMapClick, measureStartPoint]);

  // Gérer le mouvement de la souris en mode mesure
  useEffect(() => {
    if (!mapInstanceRef.current || !isMeasuringMode) return;

    const handleMouseMove = (e: L.LeafletMouseEvent) => {
      if (measureStartPoint && !measureDistance) {
        setCurrentMousePos({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    };

    mapInstanceRef.current.on('mousemove', handleMouseMove);

    return () => {
      mapInstanceRef.current?.off('mousemove', handleMouseMove);
    };
  }, [isMeasuringMode, measureStartPoint, measureDistance]);

  // Fonction pour calculer la distance (Haversine)
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // Rayon de la Terre en mètres
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Gérer le curseur en mode ajout, routage ou mesure
  useEffect(() => {
    if (!mapRef.current) return;

    if (isAddingMode || isRoutingMode || isMeasuringMode) {
      mapRef.current.style.cursor = 'crosshair';
    } else {
      mapRef.current.style.cursor = '';
    }
  }, [isAddingMode, isRoutingMode, isMeasuringMode]);

  // Mettre à jour la position du panneau lors des mouvements de carte
  useEffect(() => {
    if (!mapInstanceRef.current || !isMeasuringMode || !measureStartPoint) return;

    const handleMapMove = () => {
      setMapMoveCounter(prev => prev + 1);
    };

    mapInstanceRef.current.on('move', handleMapMove);
    mapInstanceRef.current.on('zoom', handleMapMove);

    return () => {
      mapInstanceRef.current?.off('move', handleMapMove);
      mapInstanceRef.current?.off('zoom', handleMapMove);
    };
  }, [isMeasuringMode, measureStartPoint]);

  // Afficher la ligne de mesure
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Supprimer l'ancienne ligne
    if (measureLineRef.current) {
      measureLineRef.current.remove();
      measureLineRef.current = null;
    }

    // Supprimer l'ancien marqueur
    if (measureMarkerRef.current) {
      measureMarkerRef.current.remove();
      measureMarkerRef.current = null;
    }

    if (!isMeasuringMode) {
      setMeasureStartPoint(null);
      setMeasureDistance(null);
      setCurrentMousePos(null);
      return;
    }

    if (measureStartPoint) {
      const endPoint = measureDistance ? null : currentMousePos;
      
      if (endPoint || measureDistance) {
        const actualEndPoint = endPoint || currentMousePos;
        
        if (actualEndPoint) {
          // Calculer la distance
          const distance = calculateDistance(
            measureStartPoint.lat,
            measureStartPoint.lng,
            actualEndPoint.lat,
            actualEndPoint.lng
          );

          // Ne pas afficher si > 1000m
          if (distance <= 1000) {
            // Dessiner la ligne
            measureLineRef.current = L.polyline(
              [[measureStartPoint.lat, measureStartPoint.lng], [actualEndPoint.lat, actualEndPoint.lng]],
              {
                color: '#9333ea',
                weight: 3,
                dashArray: measureDistance ? undefined : '10, 10',
                opacity: measureDistance ? 1 : 0.7
              }
            ).addTo(mapInstanceRef.current);

            // Ajouter un marqueur de départ
            const startIcon = L.divIcon({
              className: 'measure-marker',
              html: '<div style="width: 12px; height: 12px; background: #9333ea; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
              iconSize: [12, 12],
              iconAnchor: [6, 6]
            });

            measureMarkerRef.current = L.marker(
              [measureStartPoint.lat, measureStartPoint.lng],
              { icon: startIcon }
            ).addTo(mapInstanceRef.current);
          }
        }
      }
    }

    return () => {
      if (measureLineRef.current) {
        measureLineRef.current.remove();
        measureLineRef.current = null;
      }
      if (measureMarkerRef.current) {
        measureMarkerRef.current.remove();
        measureMarkerRef.current = null;
      }
    };
  }, [isMeasuringMode, measureStartPoint, currentMousePos, measureDistance]);

  // Gérer les marqueurs permanents
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Supprimer les anciens marqueurs
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Ajouter les nouveaux marqueurs
    locations.forEach((location) => {
      // Valider les coordonnées
      if (!location.position || 
          typeof location.position.lat !== 'number' || 
          typeof location.position.lng !== 'number' ||
          isNaN(location.position.lat) || 
          isNaN(location.position.lng)) {
        console.warn('Location avec coordonnées invalides ignorée:', location);
        return;
      }

      // Déterminer la classe CSS selon la saison
      const markerClass = location.season === 'hiver' 
        ? 'custom-marker-winter' 
        : location.season === 'été'
        ? 'custom-marker-summer'
        : 'custom-marker';

      const customIcon = L.divIcon({
        className: markerClass,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([location.position.lat, location.position.lng], {
        icon: customIcon
      });

      marker.bindPopup(`<div class="text-sm"><h3 class="font-semibold">${location.title}</h3></div>`);
      
      marker.on('click', () => {
        if (!isAddingMode) {
          onLocationClick(location);
        }
      });

      marker.addTo(mapInstanceRef.current!);
      markersRef.current.push(marker);
    });
  }, [locations, onLocationClick, isAddingMode]);

  // Gérer le marqueur temporaire
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Supprimer l'ancien marqueur temporaire
    if (temporaryMarkerRef.current) {
      temporaryMarkerRef.current.remove();
      temporaryMarkerRef.current = null;
    }

    // Ajouter le nouveau marqueur temporaire
    if (temporaryMarkerPosition) {
      // Valider les coordonnées
      if (typeof temporaryMarkerPosition.lat !== 'number' || 
          typeof temporaryMarkerPosition.lng !== 'number' ||
          isNaN(temporaryMarkerPosition.lat) || 
          isNaN(temporaryMarkerPosition.lng)) {
        console.warn('Position temporaire avec coordonnées invalides ignorée:', temporaryMarkerPosition);
        return;
      }

      const temporaryIcon = L.divIcon({
        className: 'temporary-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker(
        [temporaryMarkerPosition.lat, temporaryMarkerPosition.lng],
        { icon: temporaryIcon }
      );

      marker.addTo(mapInstanceRef.current);
      temporaryMarkerRef.current = marker;
    }
  }, [temporaryMarkerPosition]);

  // Centrer sur le point sélectionné (sans changer le zoom)
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedLocation) return;

    // Valider les coordonnées avant flyTo
    if (!selectedLocation.position || 
        typeof selectedLocation.position.lat !== 'number' || 
        typeof selectedLocation.position.lng !== 'number' ||
        isNaN(selectedLocation.position.lat) || 
        isNaN(selectedLocation.position.lng)) {
      console.error('Impossible de centrer sur un point avec des coordonnées invalides:', selectedLocation);
      return;
    }

    // Centrer sans changer le zoom (utiliser le zoom actuel)
    const currentZoom = mapInstanceRef.current.getZoom();
    mapInstanceRef.current.flyTo(
      [selectedLocation.position.lat, selectedLocation.position.lng],
      currentZoom,
      { duration: 1 }
    );
  }, [selectedLocation]);

  // Gérer les points d'itinéraire
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Nettoyer les anciens marqueurs d'itinéraire
    routeMarkersRef.current.forEach(marker => marker.remove());
    routeMarkersRef.current = [];

    // Nettoyer l'ancienne route
    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    if (routePoints.length === 0) return;

    // Ajouter des marqueurs pour chaque point d'itinéraire
    routePoints.forEach((point, index) => {
      // Valider les coordonnées
      if (typeof point.lat !== 'number' || 
          typeof point.lng !== 'number' ||
          isNaN(point.lat) || 
          isNaN(point.lng)) {
        console.warn('Point d\'itinéraire avec coordonnées invalides ignoré:', point);
        return;
      }

      const icon = L.divIcon({
        html: `<div style="
          background-color: #2563eb;
          color: white;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 14px;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        ">${index + 1}</div>`,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([point.lat, point.lng], { icon });
      marker.addTo(map);
      routeMarkersRef.current.push(marker);
    });

    // Tracer l'itinéraire
    if (routePoints.length >= 2) {
      if (isSmartRouting) {
        // Routage intelligent avec l'API OSRM directement
        const coordinates = routePoints.map(p => `${p.lng},${p.lat}`).join(';');
        const osrmUrl = `https://router.project-osrm.org/route/v1/foot/${coordinates}?overview=full&geometries=geojson`;
        
        fetch(osrmUrl)
          .then(response => response.json())
          .then(data => {
            if (data.code === 'Ok' && data.routes && data.routes[0]) {
              const route = data.routes[0];
              const coords = route.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
              
              const polyline = L.polyline(coords, { 
                color: '#2563eb', 
                weight: 4, 
                opacity: 0.8 
              });
              polyline.addTo(map);
              routeLayerRef.current = polyline;
              
              // Ajuster la vue pour voir tout l'itinéraire
              map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
            } else {
              // Fallback sur ligne droite en cas d'erreur
              const polyline = L.polyline(
                routePoints.map(p => [p.lat, p.lng]),
                { color: '#2563eb', weight: 4, opacity: 0.8 }
              );
              polyline.addTo(map);
              routeLayerRef.current = polyline;
              map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
            }
          })
          .catch(error => {
            console.error('Erreur lors du calcul de l\'itinéraire intelligent:', error);
            // Fallback sur ligne droite en cas d'erreur
            const polyline = L.polyline(
              routePoints.map(p => [p.lat, p.lng]),
              { color: '#2563eb', weight: 4, opacity: 0.8 }
            );
            polyline.addTo(map);
            routeLayerRef.current = polyline;
            map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
          });
      } else {
        // Ligne droite simple
        const polyline = L.polyline(
          routePoints.map(p => [p.lat, p.lng]),
          { color: '#2563eb', weight: 4, opacity: 0.8, dashArray: '10, 10' }
        );
        polyline.addTo(map);
        routeLayerRef.current = polyline;

        // Ajuster la vue pour voir tout l'itinéraire
        map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
      }
    }
  }, [routePoints, isSmartRouting]);

  // Charger les points d'eau - chargement initial automatique puis manuel
  useEffect(() => {
    if (!mapInstanceRef.current || !showWaterPoints) {
      // Nettoyer les marqueurs si désactivé
      waterMarkersRef.current.forEach(marker => marker.remove());
      waterMarkersRef.current = [];
      setShowRefreshButton(false);
      return;
    }

    const map = mapInstanceRef.current;

    const loadWaterPoints = async (isManual: boolean = false) => {
      const bounds = map.getBounds();
      
      // Vérifier la taille de la zone AVANT de faire la requête
      const latDiff = Math.abs(bounds.getNorth() - bounds.getSouth());
      const lngDiff = Math.abs(bounds.getEast() - bounds.getWest());
      const area = latDiff * lngDiff;
      const isZoneTooLarge = latDiff > 0.5 || lngDiff > 0.5 || area > 0.1;
      
      if (isZoneTooLarge) {
        // Zone trop grande : afficher message et bouton sans faire de requête
        setWaterError('🔍 Zoomez davantage sur la carte pour charger les points d\'eau.');
        setShowRefreshButton(true);
        onWaterStateChange?.({ isLoading: false, showButton: true });
        return; // Sortir sans faire la requête
      }
      
      setIsLoadingWater(true);
      setWaterError(null);
      // Ne cacher le bouton que temporairement pendant le chargement manuel
      if (isManual) {
        setShowRefreshButton(false);
      }
      
      // Notifier le parent du changement d'état
      onWaterStateChange?.({ isLoading: true, showButton: false });
      
      try {
        const points = await fetchWaterPoints({
          south: bounds.getSouth(),
          west: bounds.getWest(),
          north: bounds.getNorth(),
          east: bounds.getEast(),
        });
        
        setWaterPoints(points);
        onWaterPointsLoaded?.(points);
        setIsManualLoad(isManual);
      } catch (error: any) {
        // Log simplifié pour ne pas encombrer la console
        const errorType = error?.name === 'RateLimitError' ? 'Rate limit' : 
                         error?.message?.includes('504') ? 'Timeout 504' :
                         error?.message?.includes('503') ? 'Service indisponible' :
                         error?.message?.includes('429') ? 'Trop de requêtes' :
                         error?.message?.includes('Zone trop grande') ? 'Zone trop grande' :
                         error?.name === 'AbortError' ? 'Timeout' :
                         'Erreur inconnue';
        console.warn(`⚠️ Points d'eau: ${errorType}`);
        
        // Gérer différents types d'erreurs
        if (error?.name === 'RateLimitError') {
          // Extraire le temps d'attente du message d'erreur si disponible
          const match = error.message.match(/(\d+) secondes/);
          const waitTime = match ? match[1] : 'quelques';
          setWaterError(`⏸️ Trop de requêtes. Patientez ${waitTime} secondes avant de déplacer la carte.`);
        } else if (error?.message?.includes('Zone trop grande')) {
          setWaterError('🔍 Zoomez davantage sur la carte pour charger les points d\'eau.');
        } else if (error?.message?.includes('504') || error?.message?.includes('Gateway Timeout') || error?.message?.includes('Timeout')) {
          setWaterError('⏱️ Temps de réponse dépassé. La zone est trop grande ou l\'API est surchargée. Zoomez davantage.');
        } else if (error?.message?.includes('503') || error?.message?.includes('surchargée') || error?.message?.includes('indisponible')) {
          setWaterError('🔴 L\'API est temporairement surchargée. Réessayez dans 2 minutes.');
        } else if (error?.message?.includes('429')) {
          setWaterError('⏸️ Trop de requêtes. Patientez 1 minute avant de réessayer.');
        } else if (error?.name === 'AbortError') {
          setWaterError('⏱️ Requête trop longue annulée. La zone est trop étendue, zoomez davantage.');
        } else {
          setWaterError('❌ Impossible de charger les points d\'eau. Vérifiez votre connexion ou réessayez plus tard.');
        }
        
        // Réafficher le bouton en cas d'erreur pour permettre un nouvel essai
        if (isManual) {
          setShowRefreshButton(true);
          onWaterStateChange?.({ isLoading: false, showButton: true });
        }
      } finally {
        setIsLoadingWater(false);
        onWaterStateChange?.({ isLoading: false, showButton: showRefreshButton });
      }
    };

    // Vérifier si la zone est raisonnable pour un chargement automatique
    const bounds = map.getBounds();
    const latDiff = Math.abs(bounds.getNorth() - bounds.getSouth());
    const lngDiff = Math.abs(bounds.getEast() - bounds.getWest());
    const isZoneReasonable = latDiff <= 0.5 && lngDiff <= 0.5 && (latDiff * lngDiff) <= 0.1;

    // Charger automatiquement seulement si la zone est raisonnable ET que l'utilisateur n'a pas encore interagi
    if (!hasUserInteracted && isZoneReasonable) {
      loadWaterPoints(false);
    } else if (!hasUserInteracted && !isZoneReasonable) {
      // Zone trop grande : afficher directement le bouton sans message
      setShowRefreshButton(true);
      onWaterStateChange?.({ isLoading: false, showButton: true });
    } else if (hasUserInteracted) {
      // L'utilisateur a déjà interagi avec la carte : afficher le bouton immédiatement sans message
      setShowRefreshButton(true);
      onWaterStateChange?.({ isLoading: false, showButton: true });
    }

    // Détecter les interactions utilisateur (moveend = move + zoom)
    const handleMoveEnd = () => {
      if (!hasUserInteracted) {
        setHasUserInteracted(true);
      }
      // Afficher le bouton de refresh après interaction
      setShowRefreshButton(true);
      onWaterStateChange?.({ isLoading: false, showButton: true });
      
      // Notifier le parent des nouveaux bounds
      if (onMapMove) {
        const bounds = map.getBounds();
        onMapMove({
          south: bounds.getSouth(),
          north: bounds.getNorth(),
          west: bounds.getWest(),
          east: bounds.getEast()
        });
      }
    };

    map.on('moveend', handleMoveEnd);

    // Exposer la fonction de chargement manuel pour le bouton
    (window as any).__loadWaterPointsManually = () => {
      loadWaterPoints(true);
    };

    return () => {
      map.off('moveend', handleMoveEnd);
      delete (window as any).__loadWaterPointsManually;
    };
  }, [showWaterPoints, hasUserInteracted, onMapMove, showProtectedAreas]);

  // Filtrer et limiter les points d'eau à afficher
  // 35 max pour le chargement automatique, illimité pour le chargement manuel
  const filteredWaterPoints = useMemo(() => {
    if (!showWaterPoints || waterPoints.length === 0) return [];
    
    // Extraire les positions des spots de bivouac
    const spotPositions = locations.map(loc => ({
      lat: loc.position.lat,
      lng: loc.position.lng
    }));
    
    // Si chargement manuel, pas de limite (undefined)
    // Si chargement automatique, limite à 35
    const maxPoints = isManualLoad ? undefined : 35;
    return filterAndSortWaterPoints(waterPoints, spotPositions, maxPoints);
  }, [waterPoints, locations, showWaterPoints, isManualLoad]);

  // Afficher les marqueurs de points d'eau
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Nettoyer les anciens marqueurs
    waterMarkersRef.current.forEach(marker => marker.remove());
    waterMarkersRef.current = [];

    if (!showWaterPoints) return;

    // Ajouter les nouveaux marqueurs (limités et triés)
    filteredWaterPoints.forEach((waterPoint) => {
      const drinkable = isDrinkable(waterPoint);
      const label = getWaterPointLabel(waterPoint);
      const info = getWaterPointInfo(waterPoint);

      // Icône personnalisée pour les points d'eau
      const customIcon = L.divIcon({
        className: drinkable ? 'water-marker-drinkable' : 'water-marker',
        html: `<div style="
          background-color: ${drinkable ? '#0ea5e9' : '#0284c7'};
          border: 3px solid white;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(14, 165, 233, 0.4);
          position: relative;
        ">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
          </svg>
        </div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      const marker = L.marker([waterPoint.lat, waterPoint.lng], {
        icon: customIcon,
        zIndexOffset: -100, // Afficher sous les marqueurs de bivouac
      });

      // Popup avec informations détaillées
      const popupContent = `
        <div class="text-sm">
          <h3 class="font-semibold text-blue-600">${label}</h3>
          ${info.length > 0 ? `
            <ul class="mt-2 text-xs space-y-1">
              ${info.map(i => `<li class="text-gray-700">${i}</li>`).join('')}
            </ul>
          ` : ''}
          <p class="mt-2 text-xs text-gray-500">Source: OpenStreetMap</p>
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.addTo(map);
      waterMarkersRef.current.push(marker);
    });
  }, [filteredWaterPoints, showWaterPoints]);

  // Afficher les zones protégées sur la carte
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Nettoyer les anciennes zones
    protectedAreasLayersRef.current.forEach(layer => layer.remove());
    protectedAreasLayersRef.current = [];

    if (!showProtectedAreas || protectedAreas.length === 0) return;

    // Ajouter les nouvelles zones (uniquement celles avec camping interdit)
    protectedAreas.forEach((area) => {
      // Filtrer : afficher uniquement les zones interdites sur la carte
      if (!shouldDisplayOnMap(area)) return;
      
      const info = getProtectedAreaInfo(area);
      
      // Créer le polygone avec z-index basé sur la taille (petites zones au-dessus)
      const geometry = area.geometry;
      const bounds = {
        minLat: Math.min(...geometry.map(p => p.lat)),
        maxLat: Math.max(...geometry.map(p => p.lat)),
        minLng: Math.min(...geometry.map(p => p.lng)),
        maxLng: Math.max(...geometry.map(p => p.lng))
      };
      const areaSize = (bounds.maxLat - bounds.minLat) * (bounds.maxLng - bounds.minLng);
      const zIndex = Math.round(1000 - areaSize * 10000); // Petites zones = z-index plus haut

      const polygon = L.polygon(
        geometry.map(point => [point.lat, point.lng]),
        {
          color: info.color,
          weight: 2,
          opacity: 0.8,
          fillColor: info.color,
          fillOpacity: 0.15,
          interactive: true,
        }
      );

      // Ajouter les événements pour rendre la zone cliquable même si au-dessus
      polygon.on('mouseenter', function() {
        this.bringToFront();
        this.setStyle({ weight: 3, opacity: 1 });
      });
      polygon.on('mouseleave', function() {
        this.setStyle({ weight: 2, opacity: 0.8 });
      });

      // Popup avec informations détaillées
      const popupContent = `
        <div class="text-sm max-w-sm">
          <h3 class="font-semibold text-orange-700 mb-2">${info.title}</h3>
          ${info.description ? `<p class="text-xs text-gray-600 mb-3">${info.description}</p>` : ''}
          ${info.restrictions.length > 0 ? `
            <div class="space-y-1">
              <p class="text-xs font-semibold text-gray-700">Réglementation :</p>
              <ul class="text-xs space-y-1">
                ${info.restrictions.map(r => `<li class="text-gray-700">${r}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          ${area.tags.website ? `
            <p class="mt-2 text-xs">
              <a href="${area.tags.website}" target="_blank" class="text-blue-600 hover:underline">Plus d'infos →</a>
            </p>
          ` : ''}
          <p class="mt-2 text-xs text-gray-500">Source: OpenStreetMap</p>
        </div>
      `;

      polygon.bindPopup(popupContent);
      polygon.addTo(map);
      (polygon as any)._zIndex = zIndex;
      protectedAreasLayersRef.current.push(polygon);
    });
  }, [protectedAreas, showProtectedAreas]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      
      {/* Message d'erreur ou d'info - s'affiche au-dessus du bouton si nécessaire */}
      {showWaterPoints && waterError && (
        <div className={`absolute left-1/2 transform -translate-x-1/2 top-6 z-[1050] ${waterError.includes('🔍') ? 'bg-blue-50 border-l-4 border-blue-400' : 'bg-yellow-50 border-l-4 border-yellow-400'} rounded-r-lg shadow-lg px-4 py-2 max-w-md`}>
          <p className={`text-sm ${waterError.includes('🔍') ? 'text-blue-800' : 'text-yellow-800'}`}>{waterError}</p>
        </div>
      )}

      {/* Panneau de mesure */}
      {isMeasuringMode && measureStartPoint && mapInstanceRef.current && (() => {
        // Convertir les coordonnées géographiques en coordonnées écran
        const point = mapInstanceRef.current!.latLngToContainerPoint([measureStartPoint.lat, measureStartPoint.lng]);
        
        // Ajuster la position pour éviter que le panneau sorte de l'écran
        const topOffset = point.y < 100 ? 20 : -80; // Si trop haut, mettre en dessous
        
        return (
          <div 
            className="absolute z-[600] bg-purple-600 text-white rounded-lg shadow-xl px-4 py-3 pointer-events-auto whitespace-nowrap"
            style={{
              left: `${point.x}px`,
              top: `${point.y + topOffset}px`,
              transform: 'translateX(-50%)'
            }}
          >
            {measureDistance !== null ? (
              <div className="flex items-center gap-3">
                <div>
                  <div className="text-xs font-medium opacity-90">Distance mesurée</div>
                  <div className="text-xl font-bold">{measureDistance.toFixed(1)} m</div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMeasureStartPoint(null);
                    setMeasureDistance(null);
                    setCurrentMousePos(null);
                  }}
                  className="p-2 hover:bg-purple-700 rounded-lg transition-colors"
                  title="Supprimer la mesure"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : currentMousePos ? (
              <div className="text-center">
                <div className="text-xs font-medium opacity-90">Mesure en cours</div>
                <div className="text-xl font-bold">
                  {(() => {
                    const dist = calculateDistance(
                      measureStartPoint.lat,
                      measureStartPoint.lng,
                      currentMousePos.lat,
                      currentMousePos.lng
                    );
                    return dist > 1000 ? '> 1000 m' : `${dist.toFixed(1)} m`;
                  })()}
                </div>
              </div>
            ) : (
              <div className="text-xs">Déplacez pour mesurer</div>
            )}
          </div>
        );
      })()}
      
      {/* Panel de contrôles cartographiques en bas à droite */}
      {onWaterPointsToggle && onProtectedAreasToggle && onRouteClick && onMeasureClick && (
        <MapControls
          showWaterPoints={showWaterPoints}
          onWaterPointsToggle={onWaterPointsToggle}
          showProtectedAreas={showProtectedAreas}
          onProtectedAreasToggle={onProtectedAreasToggle}
          onRouteClick={onRouteClick}
          isRoutingMode={isRoutingMode}
          isMeasuringMode={isMeasuringMode}
          onMeasureClick={onMeasureClick}
          satelliteMode={satelliteMode}
          onSatelliteModeToggle={onSatelliteModeToggle || (() => {})}
          winterMode={winterMode}
          onWinterModeToggle={onWinterModeToggle}
        />
      )}
    </div>
  );
}