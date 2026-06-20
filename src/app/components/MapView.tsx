import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import { Trash2, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { PoiLocation } from '../types';
import { fetchWaterPoints, WaterPoint, getWaterPointLabel, getWaterPointInfo, RateLimitError, filterAndSortWaterPoints } from '../services/overpass';
import { ProtectedArea, getProtectedAreaLabel, getProtectedAreaInfo, shouldDisplayOnMap } from '../services/protected-areas';
import { CustomZone } from '../../utils/supabase/custom-zones-api';
import { MapControls } from './MapControls';
import { MAP_CENTER, MAP_DEFAULT_ZOOM } from '../constants';

function makeCrosshairIcon(color: string, size: number): L.DivIcon {
  const h = size / 2;
  const gap = Math.round(size * 0.18);
  return L.divIcon({
    html: `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <line x1="${h}" y1="2" x2="${h}" y2="${h - gap}" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="${h}" y1="${h + gap}" x2="${h}" y2="${size - 2}" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="2" y1="${h}" x2="${h - gap}" y2="${h}" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="${h + gap}" y1="${h}" x2="${size - 2}" y2="${h}" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="${h}" cy="${h}" r="3" fill="${color}" stroke="white" stroke-width="1.5"/>
    </svg>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [h, h],
  });
}

interface MapViewProps {
  locations: PoiLocation[];
  onLocationClick: (location: PoiLocation) => void;
  selectedLocation: PoiLocation | null;
  isAddingMode?: boolean;
  isRoutingMode?: boolean;
  isMeasuringMode?: boolean;
  isDrawingMode?: boolean;
  drawTool?: 'polygon' | 'rectangle';
  onMapClick?: (lat: number, lng: number) => void;
  onGeometryDrawn?: (geometry: GeoJSON.Feature) => void;
  temporaryMarkerPosition?: { lat: number; lng: number } | null;
  routePoints?: Array<{ lat: number; lng: number }>;
  isSmartRouting?: boolean;
  showWaterPoints?: boolean;
  showProtectedAreas?: boolean;
  protectedAreas?: ProtectedArea[];
  customZones?: CustomZone[];
  onZoneClick?: (zone: CustomZone) => void;
  onProtectedAreaClick?: (area: ProtectedArea) => void;
  onMapMove?: (bounds: any) => void;
  onWaterPointsToggle?: () => void;
  onProtectedAreasToggle?: () => void;
  onRouteClick?: () => void;
  onMeasureClick?: () => void;
  onWaterStateChange?: (state: { isLoading: boolean; showButton: boolean }) => void;
  onWaterPointsLoaded?: (points: WaterPoint[]) => void;
  showRainRadar?: boolean;
  onRainRadarToggle?: () => void;
  showLightning?: boolean;
  onLightningToggle?: () => void;
  satelliteMode?: boolean;
  onSatelliteModeToggle?: () => void;
  winterMode?: boolean;
  onWinterModeToggle?: () => void;
  userPosition?: { lat: number; lng: number } | null;
  selectedZone?: CustomZone | null;
  selectedProtectedArea?: ProtectedArea | null;
}

const LEGEND_ITEMS = [
  { color: '#b3f0ff', label: 'Très légère  < 0.5 mm/h' },
  { color: '#64d4f0', label: 'Légère  0.5–2 mm/h' },
  { color: '#3eb050', label: 'Modérée  2–5 mm/h' },
  { color: '#f0f050', label: 'Notable  5–15 mm/h' },
  { color: '#f09000', label: 'Forte  15–30 mm/h' },
  { color: '#d03020', label: 'Très forte  > 30 mm/h' },
  { color: '#f060f0', label: 'Extrême / grêle' },
];

function LegendContent({ forecastMode }: { forecastMode: boolean }) {
  return (
    <div className="px-3 pb-3 pt-1">
      <div className="text-xs text-gray-500 mb-2">
        {forecastMode ? 'Prévision nowcast · extrapolation radar' : 'Données observées · ~10 min de délai'}
      </div>
      <div className="flex flex-col gap-0.5">
        {LEGEND_ITEMS.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-5 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
            <span className="text-xs text-gray-600">{label}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-400">Source : RainViewer</div>
    </div>
  );
}

export function MapView({
  locations,
  onLocationClick,
  selectedLocation,
  isAddingMode = false,
  isRoutingMode = false,
  isMeasuringMode = false,
  isDrawingMode = false,
  drawTool = 'polygon',
  onMapClick,
  onGeometryDrawn,
  temporaryMarkerPosition,
  routePoints = [],
  isSmartRouting = true,
  showWaterPoints = false,
  showProtectedAreas = false,
  protectedAreas = [],
  customZones = [],
  onZoneClick,
  onProtectedAreaClick,
  onMapMove,
  onWaterPointsToggle,
  onProtectedAreasToggle,
  onRouteClick,
  onMeasureClick,
  onWaterStateChange,
  onWaterPointsLoaded,
  showRainRadar = false,
  onRainRadarToggle,
  showLightning = false,
  onLightningToggle,
  satelliteMode = false,
  onSatelliteModeToggle,
  winterMode = false,
  onWinterModeToggle,
  userPosition = null,
  selectedZone = null,
  selectedProtectedArea = null,
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const temporaryMarkerRef = useRef<L.Marker | null>(null);
  const routeMarkersRef = useRef<L.Marker[]>([]);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const waterMarkersRef = useRef<L.Marker[]>([]);
  const protectedAreasLayersRef = useRef<L.Polygon[]>([]);
  const customZonesLayersRef = useRef<L.Polygon[]>([]);
  const measureLineRef = useRef<L.Polyline | null>(null);
  const measureMarkerRef = useRef<L.Marker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const slopesLayerRef = useRef<L.TileLayer | null>(null);
  const drawControlRef = useRef<any>(null);
  const drawLayerRef = useRef<L.FeatureGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const searchMarkerRef = useRef<L.Marker | null>(null);
  const searchMarkerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rainRadarLayersRef = useRef<L.TileLayer[]>([]);
  const rainRadarAnimRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rainRadarIndexRef = useRef(0);
  const [forecastMode, setForecastMode] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [attribOpen, setAttribOpen] = useState(false);
  const [nowcastDurationMin, setNowcastDurationMin] = useState(0);
  const lightningEsRef = useRef<EventSource | null>(null);
  const lightningMarkersRef = useRef<{ marker: L.CircleMarker; timeout: ReturnType<typeof setTimeout> }[]>([]);
  
  const [waterPoints, setWaterPoints] = useState<WaterPoint[]>([]);
  const [isLoadingWater, setIsLoadingWater] = useState(false);
  const [waterError, setWaterError] = useState<string | null>(null);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [showRefreshButton, setShowRefreshButton] = useState(false);
  const [isManualLoad, setIsManualLoad] = useState(false);

  // Refs pour callbacks parents — évite que l'effect se ré-exécute à chaque render du parent
  // tout en gardant un accès toujours frais aux dernières valeurs
  const onMapMoveRef = useRef(onMapMove);
  const onWaterStateChangeRef = useRef(onWaterStateChange);
  useEffect(() => { onMapMoveRef.current = onMapMove; }, [onMapMove]);
  useEffect(() => { onWaterStateChangeRef.current = onWaterStateChange; }, [onWaterStateChange]);

  
  // États pour l'outil de mesure
  const [measureStartPoint, setMeasureStartPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [measureDistance, setMeasureDistance] = useState<number | null>(null);
  const [currentMousePos, setCurrentMousePos] = useState<{ lat: number; lng: number } | null>(null);
  const [mapMoveCounter, setMapMoveCounter] = useState(0); // Pour forcer le re-render du panneau de mesure

  // Initialiser la carte
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView([MAP_CENTER.lat, MAP_CENTER.lng], MAP_DEFAULT_ZOOM);

    // Ajouter les tuiles avec fond topographique
    const tileLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: 'Map data: &copy; OpenStreetMap contributors | Map style: &copy; OpenTopoMap',
      maxZoom: 17
    }).addTo(map);
    
    tileLayerRef.current = tileLayer;
    mapInstanceRef.current = map;

    // Listener permanent — notifie les bounds à chaque moveend, indépendamment de showWaterPoints
    map.on('moveend', () => {
      const b = map.getBounds();
      onMapMoveRef.current?.({
        south: b.getSouth(),
        north: b.getNorth(),
        west: b.getWest(),
        east: b.getEast(),
      });
    });

    // Exposer les fonctions de zoom pour les contrôles personnalisés
    (window as any).__mapZoomIn = () => map.zoomIn();
    (window as any).__mapZoomOut = () => map.zoomOut();
    
    // Move the map so `lat/lng` appears centered in the visible strip (between header and panel)
    const panToTop = (lat: number, lng: number) => {
      const zoom = map.getZoom();
      const mapHeight = map.getSize().y;
      const headerHeight = 64;
      const panelHeight = mapHeight * (2 / 3);
      const visibleHeight = mapHeight - panelHeight - headerHeight;
      const targetY = headerHeight + visibleHeight / 2;
      const spotPoint = map.project([lat, lng], zoom);
      const centerPoint = L.point(spotPoint.x, spotPoint.y + (mapHeight / 2 - targetY));
      const center = map.unproject(centerPoint, zoom);
      map.setView(center, zoom, { animate: false });
    };

    // Expose for geolocation button — zoom max (17 = détail max OpenTopoMap)
    (window as any).__mapCenterTo = (lat: number, lng: number) => {
      map.setView([lat, lng], 17, { animate: true });
    };

    (window as any).__mapPanToSpot = (lat: number, lng: number) => {
      panToTop(lat, lng);
    };

    // Géolocalisation en mode ajout : zoom 14 + point au centre de la zone visible (hors overlay 50vh)
    (window as any).__mapPanToAddMode = (lat: number, lng: number) => {
      const targetZoom = 14;
      const mapHeight = map.getSize().y;
      const targetY = mapHeight * 0.25;
      const spotPoint = map.project([lat, lng], targetZoom);
      const centerPoint = L.point(spotPoint.x, spotPoint.y + (mapHeight / 2 - targetY));
      const center = map.unproject(centerPoint, targetZoom);
      map.setView(center, targetZoom, { animate: false });
    };

    // Helpers pour le marqueur de résultat de recherche
    const placeSearchMarker = (targetLat: number, targetLng: number) => {
      if (searchMarkerTimeoutRef.current) clearTimeout(searchMarkerTimeoutRef.current);
      if (searchMarkerRef.current) map.removeLayer(searchMarkerRef.current);
      searchMarkerRef.current = L.marker([targetLat, targetLng], {
        icon: makeCrosshairIcon('#ea580c', 40),
        zIndexOffset: 900,
      }).addTo(map);
      searchMarkerTimeoutRef.current = setTimeout(() => {
        if (searchMarkerRef.current) {
          map.removeLayer(searchMarkerRef.current);
          searchMarkerRef.current = null;
        }
      }, 8000);
    };

    (window as any).__mapClearSearchMarker = () => {
      if (searchMarkerTimeoutRef.current) clearTimeout(searchMarkerTimeoutRef.current);
      if (searchMarkerRef.current) {
        map.removeLayer(searchMarkerRef.current);
        searchMarkerRef.current = null;
      }
    };

    // Navigation géocodage : fitBounds sur le bbox Nominatim, fallback flyTo
    (window as any).__mapFitBounds = (bbox: [string, string, string, string], lat?: number, lng?: number) => {
      const targetLat = lat !== undefined ? lat : undefined;
      const targetLng = lng !== undefined ? lng : undefined;
      try {
        const [south, north, west, east] = bbox.map(parseFloat);
        const latSpan = north - south;
        const lngSpan = east - west;
        const centerLat = targetLat ?? (south + north) / 2;
        const centerLng = targetLng ?? (west + east) / 2;
        // Pour les petits bbox (sommet, col, village) → zoom 14 sur le point exact
        if (latSpan < 0.05 && lngSpan < 0.05) {
          map.flyTo([centerLat, centerLng], 14, { animate: true, duration: 1.2 });
        } else {
          map.flyToBounds([[south, west], [north, east]], { animate: true, duration: 1.2, maxZoom: 13, padding: [40, 40] });
        }
        if (targetLat !== undefined && targetLng !== undefined) {
          placeSearchMarker(targetLat, targetLng);
        }
      } catch {
        if (targetLat !== undefined && targetLng !== undefined) {
          map.flyTo([targetLat, targetLng], 14, { animate: true, duration: 1.2 });
          placeSearchMarker(targetLat, targetLng);
        }
      }
    };

    // TODO: geste double-tap + drag pour zoom/dézoom (désactivé — à reprendre)
    // Voir historique git pour l'implémentation précédente.

    // Notifier les bounds initiaux via la ref
    const initBounds = map.getBounds();
    onMapMoveRef.current?.({
      south: initBounds.getSouth(),
      north: initBounds.getNorth(),
      west: initBounds.getWest(),
      east: initBounds.getEast(),
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
      delete (window as any).__mapZoomIn;
      delete (window as any).__mapZoomOut;
      delete (window as any).__mapCenterTo;
      delete (window as any).__mapPanToSpot;
      delete (window as any).__mapPanToAddMode;
      delete (window as any).__mapFitBounds;
      delete (window as any).__mapClearSearchMarker;
      if (searchMarkerTimeoutRef.current) clearTimeout(searchMarkerTimeoutRef.current);
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

  // Radar précipitations RainViewer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const cleanup = () => {
      if (rainRadarAnimRef.current) {
        clearInterval(rainRadarAnimRef.current);
        rainRadarAnimRef.current = null;
      }
      rainRadarLayersRef.current.forEach(l => map.removeLayer(l));
      rainRadarLayersRef.current = [];
      rainRadarIndexRef.current = 0;
    };

    if (!showRainRadar) {
      cleanup();
      return;
    }

    const pane = map.getPane('rainRadarPane') ?? map.createPane('rainRadarPane');
    pane.style.zIndex = '250';
    pane.style.pointerEvents = 'none';
    (pane.style as any).mixBlendMode = 'multiply';

    const owmKey = import.meta.env.VITE_OWM_API_KEY as string | undefined;

    const loadOWM = () => {
      if (!mapInstanceRef.current || !owmKey) return;
      const layer = L.tileLayer(
        `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${owmKey}`,
        { opacity: 0.8, pane: 'rainRadarPane', zIndex: 250, attribution: '© OpenWeatherMap' }
      ).addTo(mapInstanceRef.current);
      rainRadarLayersRef.current = [layer];
    };

    fetch('https://api.rainviewer.com/public/weather-maps.json')
      .then(r => r.json())
      .then((data: { host: string; radar: { past: { path: string }[]; nowcast: { path: string }[] } }) => {
        if (!mapInstanceRef.current) return;
        const past = data.radar.past ?? [];
        const nowcast = data.radar.nowcast ?? [];
        const host = data.host;

        setNowcastDurationMin(nowcast.length * 10);

        const makeLayer = (path: string) => L.tileLayer(`${host}${path}/256/{z}/{x}/{y}/2/1_1.png`, {
          opacity: 0.8, pane: 'rainRadarPane', zIndex: 250,
          attribution: 'RainViewer', maxNativeZoom: 7, maxZoom: 20,
        });

        if (!forecastMode || nowcast.length === 0) {
          const latest = past[past.length - 1];
          if (!latest) { loadOWM(); return; }
          rainRadarLayersRef.current = [makeLayer(latest.path).addTo(mapInstanceRef.current!)];
        } else {
          let frameIdx = 0;
          const animate = () => {
            if (!mapInstanceRef.current) return;
            rainRadarLayersRef.current.forEach(l => mapInstanceRef.current!.removeLayer(l));
            rainRadarLayersRef.current = [makeLayer(nowcast[frameIdx].path).addTo(mapInstanceRef.current!)];
            frameIdx = (frameIdx + 1) % nowcast.length;
          };
          animate();
          rainRadarAnimRef.current = setInterval(animate, 1000);
        }
      })
      .catch(() => loadOWM());

    return cleanup;
  }, [showRainRadar, forecastMode]);

  // Points de foudre — SSE via Edge Function (proxy MQTT Blitzortung)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    const clearMarkers = () => {
      lightningMarkersRef.current.forEach(({ marker, timeout }) => {
        clearTimeout(timeout);
        map.removeLayer(marker);
      });
      lightningMarkersRef.current = [];
    };

    const cleanup = () => {
      destroyed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (lightningEsRef.current) {
        lightningEsRef.current.close();
        lightningEsRef.current = null;
      }
      clearMarkers();
    };

    if (!showLightning) {
      cleanup();
      return;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

    // Canvas renderer: beaucoup plus rapide que SVG individuel pour des centaines de markers
    const canvasRenderer = L.canvas({ padding: 0.5 });

    const connect = () => {
      if (destroyed) return;
      console.log('[lightning] opening SSE connection');
      const es = new EventSource(`${supabaseUrl}/functions/v1/lightning-proxy?apikey=${supabaseAnonKey}`);
      lightningEsRef.current = es;

      es.onopen = () => console.log('[lightning] SSE connected');

      es.onmessage = (event) => {
        if (!mapInstanceRef.current) return;
        let data: { lat?: number; lon?: number; time?: number };
        try { data = JSON.parse(event.data); } catch { return; }
        if (typeof data.lat !== 'number' || typeof data.lon !== 'number') return;

        const now = Date.now();
        const strikeTime = data.time ?? now;
        const ageMs = Math.max(0, now - strikeTime);
        const maxAgeMs = 15 * 60 * 1000;
        if (ageMs >= maxAgeMs) return;

        const remainingMs = maxAgeMs - ageMs;
        const opacity = Math.max(0.15, 1 - ageMs / maxAgeMs);

        const marker = L.circleMarker([data.lat, data.lon], {
          radius: 6,
          color: '#000000',
          fillColor: '#ffee00',
          fillOpacity: opacity,
          opacity: opacity,
          weight: 1.5,
          renderer: canvasRenderer,
        }).addTo(mapInstanceRef.current);

        const removeTimeout = setTimeout(() => {
          if (mapInstanceRef.current) mapInstanceRef.current.removeLayer(marker);
          lightningMarkersRef.current = lightningMarkersRef.current.filter(e => e.marker !== marker);
        }, remainingMs);

        lightningMarkersRef.current.push({ marker, timeout: removeTimeout });
      };

      es.onerror = () => {
        console.warn('[lightning] SSE error/closed — reconnecting in 5s');
        es.close();
        lightningEsRef.current = null;
        if (!destroyed) reconnectTimeout = setTimeout(connect, 5000);
      };
    };

    connect();

    return cleanup;
  }, [showLightning]);

  // Gérer le mode dessin (Leaflet Draw)
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Disable any previous handler
    if (drawControlRef.current) {
      drawControlRef.current.disable();
      drawControlRef.current = null;
    }
    map.off('draw:created');

    if (isDrawingMode) {
      if (!drawLayerRef.current) {
        const drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);
        drawLayerRef.current = drawnItems;
      }

      const shapeOptions = { color: '#f97316', fillOpacity: 0.2, weight: 2 };
      const handler = drawTool === 'rectangle'
        ? new (L as any).Draw.Rectangle(map, { shapeOptions })
        : new (L as any).Draw.Polygon(map, { shapeOptions, showArea: true });

      handler.enable();
      drawControlRef.current = handler;

      map.on('draw:created', (e: any) => {
        const layer = e.layer;
        drawLayerRef.current?.addLayer(layer);
        const geometry = layer.toGeoJSON();
        if (onGeometryDrawn) {
          onGeometryDrawn(geometry);
        }
      });

      return () => {
        map.off('draw:created');
        if (drawControlRef.current) {
          drawControlRef.current.disable();
          drawControlRef.current = null;
        }
      };
    } else {
      if (drawLayerRef.current) {
        map.removeLayer(drawLayerRef.current);
        drawLayerRef.current = null;
      }
    }
  }, [isDrawingMode, drawTool, onGeometryDrawn]);

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

      // Déterminer la classe CSS selon la saison et l'état sélectionné
      const isSelected = selectedLocation?.id === location.id;
      const markerClass = isSelected
        ? (location.season === 'hiver' ? 'custom-marker-winter-selected' : 'custom-marker-selected')
        : location.season === 'hiver'
        ? 'custom-marker-winter'
        : 'custom-marker-summer';

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
          (window as any).__mapPanToSpot?.(location.position.lat, location.position.lng);
        }
      });

      marker.addTo(mapInstanceRef.current!);
      markersRef.current.push(marker);
    });
  }, [locations, selectedLocation, onLocationClick, isAddingMode]);

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
        onWaterStateChangeRef.current?.({ isLoading: false, showButton: true });
        return; // Sortir sans faire la requête
      }
      
      setIsLoadingWater(true);
      setWaterError(null);
      // Ne cacher le bouton que temporairement pendant le chargement manuel
      if (isManual) {
        setShowRefreshButton(false);
      }
      
      // Notifier le parent du changement d'état
      onWaterStateChangeRef.current?.({ isLoading: true, showButton: false });
      
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
          onWaterStateChangeRef.current?.({ isLoading: false, showButton: true });
        }
      } finally {
        setIsLoadingWater(false);
        // Toujours masquer le bouton après un chargement — il réapparaîtra au prochain mouvement de carte
        onWaterStateChangeRef.current?.({ isLoading: false, showButton: false });
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
      onWaterStateChangeRef.current?.({ isLoading: false, showButton: true });
    } else if (hasUserInteracted) {
      // L'utilisateur a déjà interagi — montrer le bouton seulement si le toggle vient d'être activé
      setShowRefreshButton(true);
      onWaterStateChangeRef.current?.({ isLoading: false, showButton: true });
    }

    // Détecter les interactions utilisateur (moveend = move + zoom)
    const handleMoveEnd = () => {
      if (!hasUserInteracted) {
        setHasUserInteracted(true);
      }
      // Afficher le bouton de refresh après interaction
      setShowRefreshButton(true);
      onWaterStateChangeRef.current?.({ isLoading: false, showButton: true });
      // onMapMoveRef est appelé par l'effect permanent moveend séparé
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
  // onMapMove et onWaterStateChange sont lus via refs → pas besoin dans les deps
  // showProtectedAreas n'est pas utilisé dans cet effect → supprimé
  }, [showWaterPoints, hasUserInteracted]);

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
      // Les cours d'eau ne sont pas affichés (utilisés uniquement pour la proximité)
      if (waterPoint.waterType === 'stream') return;

      const label = getWaterPointLabel(waterPoint);
      const info = getWaterPointInfo(waterPoint);

      const isNatural = waterPoint.waterType === 'uncontrolled_water';
      const color = isNatural ? '#0d9488' : '#0ea5e9';
      const shadowColor = isNatural ? 'rgba(13, 148, 136, 0.4)' : 'rgba(14, 165, 233, 0.4)';

      const waterIconHtml = (bgColor: string, borderColor: string, shadow: string) => `<div style="
          background-color: ${bgColor};
          border: 3px solid ${borderColor};
          border-radius: 50%;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px ${shadow};
          position: relative;
        ">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
          </svg>
        </div>`;

      const customIcon = L.divIcon({
        className: isNatural ? 'water-marker-natural' : 'water-marker',
        html: waterIconHtml(color, 'white', shadowColor),
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      const selectedWaterIcon = L.divIcon({
        className: isNatural ? 'water-marker-natural' : 'water-marker',
        html: waterIconHtml('#10b981', '#10b981', 'rgba(16, 185, 129, 0.5)'),
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
      marker.on('popupopen', () => marker.setIcon(selectedWaterIcon));
      marker.on('popupclose', () => marker.setIcon(customIcon));
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

      const isAreaSelected = selectedProtectedArea?.id === area.id;
      const areaColor = isAreaSelected ? '#7f1d1d' : info.color;
      const areaFillOpacity = isAreaSelected ? 0.05 : 0.15;

      const polygon = L.polygon(
        geometry.map(point => [point.lat, point.lng]),
        {
          color: areaColor,
          weight: isAreaSelected ? 3 : 2,
          opacity: 0.8,
          fillColor: areaColor,
          fillOpacity: areaFillOpacity,
          interactive: true,
        }
      );

      // Ajouter les événements pour rendre la zone cliquable même si au-dessus
      polygon.on('mouseenter', function() {
        this.bringToFront();
        this.setStyle({ weight: 3, opacity: 1 });
      });
      polygon.on('mouseleave', function() {
        this.setStyle({ weight: isAreaSelected ? 3 : 2, opacity: 0.8 });
      });

      polygon.on('click', () => onProtectedAreaClick?.(area));

      polygon.addTo(map);
      (polygon as any)._zIndex = zIndex;
      protectedAreasLayersRef.current.push(polygon);
    });
  }, [protectedAreas, showProtectedAreas, onProtectedAreaClick, selectedProtectedArea]);

  // Afficher les zones réglementées personnalisées sur la carte
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Nettoyer les anciennes zones
    customZonesLayersRef.current.forEach(layer => layer.remove());
    customZonesLayersRef.current = [];

    if (!showProtectedAreas || !customZones || customZones.length === 0) return;

    // Ajouter les nouvelles zones personnalisées
    customZones.forEach((zone) => {
      if (!zone.geometry || !zone.geometry.geometry) return;

      const geom = zone.geometry.geometry;
      if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') return;

      // Couleur selon le type de restriction le plus sévère
      const isZoneSelected = selectedZone?.id === zone.id;
      const types = zone.restriction_types ?? [];
      const color = isZoneSelected ? '#7f1d1d'
        : types.includes('bivouac_forbidden') ? '#ef4444'
        : types.includes('camping_forbidden') ? '#f97316'
        : types.includes('fire_forbidden') ? '#eab308'
        : '#8b5cf6';

      const coordinates = geom.type === 'Polygon'
        ? geom.coordinates[0].map((coord: [number, number]) => [coord[1], coord[0]] as [number, number])
        : [];

      if (coordinates.length === 0) return;

      const zoneFillOpacity = isZoneSelected ? 0.15 : 0.25;

      const polygon = L.polygon(coordinates, {
        color,
        weight: isZoneSelected ? 3 : 2,
        opacity: 0.9,
        fillColor: color,
        fillOpacity: zoneFillOpacity,
        interactive: true,
      });

      polygon.on('mouseenter', function() {
        this.bringToFront();
        this.setStyle({ weight: 3, opacity: 1, fillOpacity: isZoneSelected ? 0.25 : 0.35 });
      });
      polygon.on('mouseleave', function() {
        this.setStyle({ weight: isZoneSelected ? 3 : 2, opacity: 0.9, fillOpacity: zoneFillOpacity });
      });

      polygon.on('click', () => onZoneClick?.(zone));

      polygon.addTo(map);
      customZonesLayersRef.current.push(polygon);
    });
  }, [customZones, showProtectedAreas, onZoneClick, selectedZone]);

  // Marqueur de position GPS utilisateur
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (userPosition) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([userPosition.lat, userPosition.lng]);
      } else {
        userMarkerRef.current = L.marker([userPosition.lat, userPosition.lng], {
          icon: makeCrosshairIcon('#2563eb', 28),
          zIndexOffset: 1000,
        }).addTo(map);
      }
    } else {
      if (userMarkerRef.current) {
        map.removeLayer(userMarkerRef.current);
        userMarkerRef.current = null;
      }
    }
  }, [userPosition]);

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
      
      {/* Légende radar précipitations — desktop (bottom-left) */}
      {showRainRadar && (
        <div className="hidden md:block absolute bottom-6 left-6 z-[400] bg-white/90 backdrop-blur-sm rounded-xl shadow-xl w-52 overflow-hidden">
          <button
            onClick={() => setLegendOpen(o => !o)}
            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors"
          >
            <span className="text-xs font-semibold text-gray-700">Légende radar pluie</span>
            {legendOpen ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
          </button>
          {legendOpen && <LegendContent forecastMode={forecastMode} />}
        </div>
      )}

      {/* Légende radar précipitations — mobile (top-left, icône seule) */}
      {showRainRadar && (
        <div className="md:hidden absolute top-[70px] left-3 z-[400]">
          <button
            onClick={() => setLegendOpen(o => !o)}
            className={`w-10 h-10 rounded-xl shadow-xl flex items-center justify-center transition-colors ${
              legendOpen ? 'bg-cyan-600 text-white' : 'bg-white/90 backdrop-blur-sm text-gray-600'
            }`}
            title="Légende radar pluie"
          >
            <Info className="w-5 h-5" />
          </button>
          {legendOpen && (
            <div className="mt-1 bg-white/90 backdrop-blur-sm rounded-xl shadow-xl w-52 overflow-hidden">
              <LegendContent forecastMode={forecastMode} />
            </div>
          )}
        </div>
      )}

      {/* Attribution sources — desktop uniquement (mobile géré dans App.tsx) */}
      <div className="hidden md:block absolute bottom-1 left-1 z-[500]">
        <div className="relative flex items-center">
          <button
            onClick={() => setAttribOpen(o => !o)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold shadow-md transition-colors ${
              attribOpen ? 'bg-gray-700 text-white' : 'bg-white/90 backdrop-blur-sm text-gray-600 hover:bg-white'
            }`}
            title="Sources cartographiques"
          >
            ©
          </button>
          {attribOpen && (
            <div className="ml-2 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg px-2.5 py-2 text-[10px] text-gray-500 whitespace-nowrap">
              {satelliteMode
                ? 'Tiles © Esri'
                : 'Map data: © OpenStreetMap contributors · Map style: © OpenTopoMap'}
            </div>
          )}
        </div>
      </div>

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
          showRainRadar={showRainRadar}
          onRainRadarToggle={onRainRadarToggle}
          showLightning={showLightning}
          onLightningToggle={onLightningToggle}
          satelliteMode={satelliteMode}
          onSatelliteModeToggle={onSatelliteModeToggle || (() => {})}
          winterMode={winterMode}
          onWinterModeToggle={onWinterModeToggle}
        />
      )}
    </div>
  );
}