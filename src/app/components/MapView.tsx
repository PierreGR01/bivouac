import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import { Trash2, ChevronDown, ChevronUp, Info, X } from 'lucide-react';
import { NIVOSES, NivoseStation } from '../data/nivoses';
import { PoiLocation } from '../types';
import { isSpotDisabled } from '../utils/spot-status';
import { fetchWaterPoints, WaterPoint, RateLimitError, filterAndSortWaterPoints } from '../services/overpass';
import { ProtectedArea, getProtectedAreaLabel, getProtectedAreaInfo, shouldDisplayOnMap } from '../services/protected-areas';
import { CustomZone } from '../../utils/supabase/custom-zones-api';
import { MapControls } from './MapControls';
import { MAP_CENTER, MAP_DEFAULT_ZOOM } from '../constants';
import { distanceToRoute, getRouteBounds } from '../utils/route-distance';
import { createIgnTopoLayer } from '../utils/ign-topo-layer';
import { computeAreaM2 } from '../utils/poi-zone';

// Au-delà de ce nombre de points, un marqueur numéroté par point (utile pour quelques
// waypoints cliqués à la main) devient illisible et coûteux à afficher — le tracé (polyligne)
// suffit à représenter une trace dense (import GPX/KML).
const MAX_ROUTE_MARKERS = 30;
// L'API de routage OSRM attend une liste de waypoints à relier, pas une trace déjà précise :
// au-delà de ce seuil on saute le routage et on trace directement les points, ce qui reproduit
// fidèlement une trace GPS dense sans dépendre d'une API externe non prévue pour ça.
const MAX_SMART_ROUTING_WAYPOINTS = 25;
// Nombre max de points d'eau affichés le long d'un tracé (les plus proches en priorité) —
// même limite d'esprit que les 35 points du calque viewport, adaptée à l'emprise plus large
// d'un itinéraire complet.
const MAX_ROUTE_WATER_MARKERS = 150;

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

interface WindGridData {
  rows: number; cols: number;
  lats: number[]; lons: number[];
  U: number[]; V: number[];
}

function interpolateWindGrid(grid: WindGridData, lat: number, lon: number): { u: number; v: number } {
  const { rows, cols, lats, lons, U, V } = grid;
  const clat = Math.max(lats[0], Math.min(lats[rows - 1], lat));
  const clon = Math.max(lons[0], Math.min(lons[cols - 1], lon));
  let r0 = 0;
  for (let i = 0; i < rows - 1; i++) { if (lats[i] <= clat) r0 = i; }
  r0 = Math.min(r0, rows - 2);
  let c0 = 0;
  for (let j = 0; j < cols - 1; j++) { if (lons[j] <= clon) c0 = j; }
  c0 = Math.min(c0, cols - 2);
  const r1 = r0 + 1, c1 = c0 + 1;
  const fy = (clat - lats[r0]) / (lats[r1] - lats[r0]);
  const fx = (clon - lons[c0]) / (lons[c1] - lons[c0]);
  const idx = (r: number, c: number) => r * cols + c;
  return {
    u: U[idx(r0,c0)]*(1-fx)*(1-fy) + U[idx(r0,c1)]*fx*(1-fy) + U[idx(r1,c0)]*(1-fx)*fy + U[idx(r1,c1)]*fx*fy,
    v: V[idx(r0,c0)]*(1-fx)*(1-fy) + V[idx(r0,c1)]*fx*(1-fy) + V[idx(r1,c0)]*(1-fx)*fy + V[idx(r1,c1)]*fx*fy,
  };
}

interface MapViewProps {
  locations: PoiLocation[];
  onLocationClick: (location: PoiLocation) => void;
  selectedLocation: PoiLocation | null;
  isAddingMode?: boolean;
  isRoutingMode?: boolean;
  isMeasuringMode?: boolean;
  isDrawingMode?: boolean;
  // Quand renseigné, le dessin en cours est celui de la zone complémentaire d'un spot :
  // affiche un badge de retour live (surface / max) distinct du dessin de zone réglementée/territoire.
  poiZoneAreaLimitM2?: number | null;
  onMapClick?: (lat: number, lng: number) => void;
  onGeometryDrawn?: (geometry: GeoJSON.Feature) => void;
  previewGeometry?: GeoJSON.Feature | null;
  temporaryMarkerPosition?: { lat: number; lng: number } | null;
  routePoints?: Array<{ lat: number; lng: number }>;
  isSmartRouting?: boolean;
  maxDistanceFromRoute?: number; // en mètres
  onNearbyWaterCountChange?: (count: number) => void;
  onRouteWaterLoadingChange?: (isLoading: boolean) => void;
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
  showWeather?: boolean;
  onWeatherToggle?: () => void;
  showWind?: boolean;
  onWindToggle?: () => void;
  showStorms?: boolean;
  onStormsToggle?: () => void;
  showNivoses?: boolean;
  onNivosesToggle?: () => void;
  satelliteMode?: boolean;
  onSatelliteModeToggle?: () => void;
  winterMode?: boolean;
  onWinterModeToggle?: () => void;
  userPosition?: { lat: number; lng: number } | null;
  selectedZone?: CustomZone | null;
  selectedProtectedArea?: ProtectedArea | null;
  onWaterPointClick?: (point: WaterPoint) => void;
  selectedWaterPoint?: WaterPoint | null;
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
  poiZoneAreaLimitM2 = null,
  onMapClick,
  onGeometryDrawn,
  previewGeometry,
  temporaryMarkerPosition,
  routePoints = [],
  isSmartRouting = true,
  maxDistanceFromRoute = 200,
  onNearbyWaterCountChange,
  onRouteWaterLoadingChange,
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
  showWeather = false,
  onWeatherToggle,
  showWind = true,
  onWindToggle,
  showStorms = true,
  onStormsToggle,
  showNivoses = true,
  onNivosesToggle,
  satelliteMode = false,
  onSatelliteModeToggle,
  winterMode = false,
  onWinterModeToggle,
  userPosition = null,
  selectedZone = null,
  selectedProtectedArea = null,
  onWaterPointClick,
  selectedWaterPoint = null,
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
  const previewLayerRef = useRef<L.GeoJSON | null>(null);
  const poiZoneLayerRef = useRef<L.GeoJSON | null>(null);
  const onGeometryDrawnRef = useRef(onGeometryDrawn);
  onGeometryDrawnRef.current = onGeometryDrawn;
  const [liveDrawAreaM2, setLiveDrawAreaM2] = useState<number | null>(null);
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
  // Wind animation
  const windRafRef = useRef<number | null>(null);
  const windParticlesRef = useRef<{ x: number; y: number; px: number; py: number; age: number; maxAge: number }[]>([]);
  const windGridRef = useRef<WindGridData | null>(null);
  // Nivoses
  const nivoseMarkersRef = useRef<L.Marker[]>([]);
  const [selectedNivose, setSelectedNivose] = useState<NivoseStation | null>(null);
  const [nivoObs, setNivoObs] = useState<{
    date: string;
    tempC: number | null;
    windKph: number | null;
    windDir: number | null;
    snowCm: number | null;
    rainMm: number | null;
  }[] | null>(null);
  const [nivoLoading, setNivoLoading] = useState(false);
  const [nivoError, setNivoError] = useState<string | null>(null);
  
  const [waterPoints, setWaterPoints] = useState<WaterPoint[]>([]);
  const [isLoadingWater, setIsLoadingWater] = useState(false);
  const [waterError, setWaterError] = useState<string | null>(null);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [showRefreshButton, setShowRefreshButton] = useState(false);
  const [isManualLoad, setIsManualLoad] = useState(false);

  // Points d'eau le long du tracé — indépendants du calque "Points d'eau" (viewport) :
  // dès qu'un itinéraire est actif, on interroge Overpass sur l'emprise du tracé entier.
  const [routeWaterPoints, setRouteWaterPoints] = useState<WaterPoint[]>([]);
  const [isLoadingRouteWater, setIsLoadingRouteWater] = useState(false);

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
    
    // Point de la carte tel que `lat/lng` apparaîtrait centré dans la bande visible (entre le
    // header et le panneau de détails mobile, qui couvre les 2/3 inférieurs de l'écran) —
    // calculé au zoom `zoom` donné, pour rester correct même quand le zoom change (flyTo).
    const getTopCenteredView = (lat: number, lng: number, zoom: number) => {
      const mapHeight = map.getSize().y;
      const headerHeight = 64;
      const panelHeight = mapHeight * (2 / 3);
      const visibleHeight = mapHeight - panelHeight - headerHeight;
      const targetY = headerHeight + visibleHeight / 2;
      const spotPoint = map.project([lat, lng], zoom);
      const centerPoint = L.point(spotPoint.x, spotPoint.y + (mapHeight / 2 - targetY));
      return map.unproject(centerPoint, zoom);
    };

    // Move the map so `lat/lng` appears centered in the visible strip (between header and panel)
    const panToTop = (lat: number, lng: number) => {
      const zoom = map.getZoom();
      const center = getTopCenteredView(lat, lng, zoom);
      map.setView(center, zoom, { animate: false });
    };

    // Expose for geolocation button — zoom max (17 = détail max OpenTopoMap)
    (window as any).__mapCenterTo = (lat: number, lng: number) => {
      map.setView([lat, lng], 17, { animate: true });
    };

    (window as any).__mapPanToSpot = (lat: number, lng: number) => {
      panToTop(lat, lng);
    };

    // Focus animé sur un spot (dashboard admin — bouton "Carte") : zoom minimum garanti,
    // sans dézoomer si on est déjà plus proche. Même offset vertical que panToTop pour que le
    // spot ne finisse pas caché sous le panneau de détails mobile, quelle que soit l'origine
    // de la navigation (liste favoris, trips, recherche...).
    (window as any).__mapFlyToSpot = (lat: number, lng: number) => {
      const targetZoom = Math.max(map.getZoom(), 15);
      const center = getTopCenteredView(lat, lng, targetZoom);
      map.flyTo(center, targetZoom, { animate: true, duration: 1.2 });
    };

    // Variante vue scindée (dashboard admin ouvert en pleine hauteur sur la gauche, largeur
    // panelWidthPx) : centre le spot dans la portion de carte encore visible à droite,
    // plutôt qu'au centre géométrique de la carte (qui serait caché sous le dashboard).
    (window as any).__mapFlyToSpotSplit = (lat: number, lng: number, panelWidthPx: number) => {
      const targetZoom = Math.max(map.getZoom(), 15);
      const mapWidth = map.getSize().x;
      const desiredScreenX = (panelWidthPx + mapWidth) / 2;
      const spotPoint = map.project([lat, lng], targetZoom);
      const centerPoint = L.point(spotPoint.x - (desiredScreenX - mapWidth / 2), spotPoint.y);
      const center = map.unproject(centerPoint, targetZoom);
      map.flyTo(center, targetZoom, { animate: true, duration: 1.2 });
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
      delete (window as any).__mapFlyToSpot;
      delete (window as any).__mapFlyToSpotSplit;
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
      // Mode normal : IGN (SCAN 25® jusqu'au zoom 16, sa résolution native maximale,
      // puis bascule automatique vers Plan IGN v2 — gratuit, sans clé — jusqu'au zoom 19)
      const ignKey = import.meta.env.VITE_IGN_SCAN25_KEY as string | undefined;
      newLayer = createIgnTopoLayer(ignKey, { pane: 'baseMapPane' }).addTo(map);

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

    if (!showWeather || !showStorms) {
      cleanup();
      return;
    }

    const pane = map.getPane('rainRadarPane') ?? map.createPane('rainRadarPane');
    pane.style.zIndex = '250';
    pane.style.pointerEvents = 'none';

    const owmKey = import.meta.env.VITE_OWM_API_KEY as string | undefined;

    const loadOWM = () => {
      if (!mapInstanceRef.current || !owmKey) return;
      const layer = L.tileLayer(
        `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${owmKey}`,
        { opacity: 0.6, pane: 'rainRadarPane', zIndex: 250, attribution: '© OpenWeatherMap' }
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
          opacity: 0.6, pane: 'rainRadarPane', zIndex: 250,
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
  }, [showWeather, showStorms, forecastMode]);

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

    if (!showWeather || !showStorms) {
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
  }, [showWeather, showStorms]);

  // Animation vent — canvas impératif + grille spatiale 4×4 Open-Meteo
  // Chaque particule est interpolée bilinéairement sur la grille → données réelles, pas de simulation
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (!showWeather || !showWind) return;

    const N_PARTICLES = 300;
    // PIXEL_SCALE est calculé dynamiquement dans animate() en fonction du zoom
    const mapContainer = map.getContainer();

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:350;';
    canvas.width = mapContainer.offsetWidth;
    canvas.height = mapContainer.offsetHeight;
    mapContainer.appendChild(canvas);

    const ctx = canvas.getContext('2d')!;

    const spawnParticle = (w: number, h: number) => {
      const x = Math.random() * w;
      const y = Math.random() * h;
      return { x, y, px: x, py: y, age: 0, maxAge: 80 + Math.floor(Math.random() * 120) };
    };

    const initParticles = () => {
      const w = canvas.width, h = canvas.height;
      windParticlesRef.current = Array.from({ length: N_PARTICLES }, () => spawnParticle(w, h));
    };
    initParticles();

    const fetchWindGrid = async () => {
      const bounds = map.getBounds();
      const buf = 0.2;
      const dLat = (bounds.getNorth() - bounds.getSouth()) * buf;
      const dLon = (bounds.getEast() - bounds.getWest()) * buf;
      const south = bounds.getSouth() - dLat;
      const north = bounds.getNorth() + dLat;
      const west = bounds.getWest() - dLon;
      const east = bounds.getEast() + dLon;
      const ROWS = 6, COLS = 6;
      const lats = Array.from({ length: ROWS }, (_, i) => south + (i / (ROWS - 1)) * (north - south));
      const lons = Array.from({ length: COLS }, (_, j) => west + (j / (COLS - 1)) * (east - west));
      const allLats: number[] = [];
      const allLons: number[] = [];
      for (const lat of lats) for (const lon of lons) {
        allLats.push(parseFloat(lat.toFixed(4)));
        allLons.push(parseFloat(lon.toFixed(4)));
      }
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?` +
          `latitude=${allLats.join(',')}&longitude=${allLons.join(',')}&` +
          `current=wind_speed_10m,wind_direction_10m`
        );
        const data: Array<{ current?: { wind_speed_10m?: number; wind_direction_10m?: number } }> = await res.json();
        if (!Array.isArray(data) || data.length !== ROWS * COLS) return;
        const U: number[] = [], V: number[] = [];
        data.forEach(pt => {
          const speed = pt.current?.wind_speed_10m ?? 0;
          const rad = ((pt.current?.wind_direction_10m ?? 0) * Math.PI) / 180;
          // convention météo : la direction est DEPUIS laquelle souffle le vent
          U.push(-speed * Math.sin(rad)); // composante est
          V.push(-speed * Math.cos(rad)); // composante nord
        });
        windGridRef.current = { rows: ROWS, cols: COLS, lats, lons, U, V };
        const speeds = data.map(pt => pt.current?.wind_speed_10m ?? 0);
        const dirs = data.map(pt => pt.current?.wind_direction_10m ?? 0);
        console.log('[wind] grid fetched — speeds (km/h):', speeds.map(s => s.toFixed(1)), 'dirs (°):', dirs.map(d => d.toFixed(0)));
      } catch { /* garde l'ancienne grille */ }
    };

    fetchWindGrid();

    // Clear uniquement sur pan — le zoom garde les particules existantes
    const onMoveStart = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      initParticles();
    };
    const onMoveEnd = () => { fetchWindGrid(); };

    map.on('movestart', onMoveStart);
    map.on('moveend', onMoveEnd);

    let destroyed = false;

    const animate = () => {
      if (destroyed) return;

      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.04)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';

      const w = canvas.width, h = canvas.height;
      const grid = windGridRef.current;

      // Échelle dynamique : km/h → px/frame, dépend du zoom
      // metersPerPixel (WebMercator) = 156543 × cos(lat) / 2^zoom
      // Facteur 150 avec clamp : zoom-cohérent mais plafonné pour éviter l'excès au zoom élevé
      const center = map.getCenter();
      const metersPerPixel = 156543.03392 * Math.cos(center.lat * Math.PI / 180) / Math.pow(2, map.getZoom());
      const PIXEL_SCALE = Math.max(0.015, Math.min(0.08, 150 / (metersPerPixel * 3.6 * 60)));

      ctx.strokeStyle = 'rgba(255,255,255,0.80)';
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';

      for (const p of windParticlesRef.current) {
        let newX = p.x, newY = p.y;

        if (grid) {
          const ll = map.containerPointToLatLng(L.point(p.x, p.y));
          const { u, v } = interpolateWindGrid(grid, ll.lat, ll.lng);
          // u = est → +px, v = nord → -py (y croît vers le bas)
          newX = p.x + u * PIXEL_SCALE;
          newY = p.y - v * PIXEL_SCALE;
        }

        p.age++;
        const expired = p.age >= p.maxAge;
        const wrapped = newX < -5 || newX > w + 5 || newY < -5 || newY > h + 5;

        if (!wrapped && !expired) {
          // Ligne de l'ancienne position vers la nouvelle → direction + longueur ∝ vitesse
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(newX, newY);
          ctx.stroke();
          p.px = p.x; p.py = p.y;
          p.x = newX; p.y = newY;
        } else {
          // Respawn aléatoire (fin de vie ou sortie d'écran)
          const fresh = spawnParticle(w, h);
          p.x = fresh.x; p.y = fresh.y; p.px = fresh.px; p.py = fresh.py;
          p.age = 0; p.maxAge = fresh.maxAge;
        }
      }

      windRafRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      destroyed = true;
      if (windRafRef.current) { cancelAnimationFrame(windRafRef.current); windRafRef.current = null; }
      map.off('movestart', onMoveStart);
      map.off('moveend', onMoveEnd);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      windGridRef.current = null;
    };
  }, [showWeather, showWind]);

  // Fetch données horaires capteur via nivo-proxy (Météo-France DPObs)
  useEffect(() => {
    if (!selectedNivose?.meteofId) {
      setNivoObs(null);
      setNivoError(null);
      return;
    }
    setNivoObs(null);
    setNivoError(null);
    setNivoLoading(true);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    fetch(`${supabaseUrl}/functions/v1/nivo-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ stationId: selectedNivose.meteofId, days: 7 }),
    })
      .then(r => r.json())
      .then((data: { observations?: typeof nivoObs; error?: string }) => {
        if (data.error) { setNivoError(data.error); }
        else { setNivoObs(data.observations ?? []); }
      })
      .catch(err => setNivoError(String(err)))
      .finally(() => setNivoLoading(false));
  }, [selectedNivose]);

  // Marqueurs Nivoses Météo-France
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const removeMarkers = () => {
      nivoseMarkersRef.current.forEach(m => map.removeLayer(m));
      nivoseMarkersRef.current = [];
    };

    if (!showWeather || !showNivoses) {
      removeMarkers();
      setSelectedNivose(null);
      return;
    }

    // Icône thermomètre (stroke Lucide) sur fond gris anthracite
    const iconHtml = `
      <div style="
        width:28px;height:28px;
        background:#374151;
        border-radius:50%;
        border:2px solid white;
        box-shadow:0 2px 6px rgba(0,0,0,0.35);
        display:flex;align-items:center;justify-content:center;
      ">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
             stroke="white" stroke-width="2.2"
             stroke-linecap="round" stroke-linejoin="round"
             xmlns="http://www.w3.org/2000/svg">
          <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
        </svg>
      </div>`;

    const icon = L.divIcon({
      html: iconHtml,
      className: '',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    NIVOSES.forEach(station => {
      const marker = L.marker([station.lat, station.lon], { icon, zIndexOffset: 200 });
      marker.on('click', () => setSelectedNivose(station));
      marker.addTo(map);
      nivoseMarkersRef.current.push(marker);
    });

    return removeMarkers;
  }, [showWeather, showNivoses]);


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
    map.off('draw:drawvertex');
    setLiveDrawAreaM2(null);

    if (isDrawingMode) {
      if (!drawLayerRef.current) {
        const drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);
        drawLayerRef.current = drawnItems;
      }

      const shapeOptions = { color: '#f97316', fillOpacity: 0.2, weight: 2 };
      const handler = new (L as any).Draw.Polygon(map, { shapeOptions, showArea: true });

      handler.enable();
      drawControlRef.current = handler;

      // Zone d'un spot : retour live sur la surface tracée (badge dédié), en plus du
      // tooltip natif de Leaflet.Draw — recalculée à chaque sommet posé.
      if (poiZoneAreaLimitM2 != null) {
        setLiveDrawAreaM2(0);
        map.on('draw:drawvertex', (e: any) => {
          const latlngs: L.LatLng[] = [];
          e.layers.eachLayer((l: any) => latlngs.push(l.getLatLng()));
          if (latlngs.length < 3) {
            setLiveDrawAreaM2(0);
            return;
          }
          const ring = latlngs.map((ll) => [ll.lng, ll.lat]);
          setLiveDrawAreaM2(computeAreaM2({ type: 'Polygon', coordinates: [ring] } as any));
        });
      }

      map.on('draw:created', (e: any) => {
        const layer = e.layer;
        drawLayerRef.current?.addLayer(layer);
        const geometry = layer.toGeoJSON();
        onGeometryDrawnRef.current?.(geometry);
        setLiveDrawAreaM2(null);
      });

      return () => {
        map.off('draw:created');
        map.off('draw:drawvertex');
        if (drawControlRef.current) {
          drawControlRef.current.disable();
          drawControlRef.current = null;
        }
        setLiveDrawAreaM2(null);
      };
    } else {
      if (drawLayerRef.current) {
        map.removeLayer(drawLayerRef.current);
        drawLayerRef.current = null;
      }
    }
    // onGeometryDrawn est lu via une ref pour ne pas recréer le handler Leaflet.Draw
    // (donc perdre le tracé en cours) à chaque re-render du parent (ex: pan/zoom qui
    // met à jour les bounds dans App.tsx et recrée l'inline callback).
  }, [isDrawingMode, poiZoneAreaLimitM2]);

  // Aperçu d'une géométrie sélectionnée sans dessin manuel (massif prédéfini, import
  // GeoJSON, édition d'un territoire) — sinon rien ne montre visuellement la sélection.
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (previewLayerRef.current) {
      map.removeLayer(previewLayerRef.current);
      previewLayerRef.current = null;
    }

    if (previewGeometry) {
      const layer = L.geoJSON(previewGeometry, {
        style: { color: '#6366f1', weight: 3, fillOpacity: 0.15, dashArray: '6 4' },
      });
      layer.addTo(map);
      previewLayerRef.current = layer;
      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
      }
    }
  }, [previewGeometry]);

  // Zone complémentaire d'un spot : donnée annexe au point, non affichée sur la carte tant
  // que la fiche du spot n'est pas ouverte (contrairement aux zones réglementées/territoires,
  // toujours visibles). Se retire dès la désélection du spot.
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (poiZoneLayerRef.current) {
      map.removeLayer(poiZoneLayerRef.current);
      poiZoneLayerRef.current = null;
    }

    if (selectedLocation?.zoneGeometry) {
      const layer = L.geoJSON(selectedLocation.zoneGeometry, {
        style: { color: '#f97316', weight: 2, fillOpacity: 0.15 },
        interactive: false,
      });
      layer.addTo(map);
      poiZoneLayerRef.current = layer;
    }
  }, [selectedLocation]);

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
        className: isSpotDisabled(location) ? `${markerClass} custom-marker-disabled` : markerClass,
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

    // Ajouter des marqueurs pour chaque point d'itinéraire (uniquement pour une courte liste
    // de waypoints cliqués à la main — une trace dense importée s'affiche via la polyligne seule)
    if (routePoints.length <= MAX_ROUTE_MARKERS) {
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
    }

    // Tracer l'itinéraire
    if (routePoints.length >= 2) {
      if (isSmartRouting && routePoints.length <= MAX_SMART_ROUTING_WAYPOINTS) {
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
      } else if (isSmartRouting) {
        // Trop de points pour router via OSRM (trace importée dense) : le tracé est déjà
        // précis, on le trace tel quel plutôt que d'appeler l'API de routage.
        const polyline = L.polyline(
          routePoints.map(p => [p.lat, p.lng]),
          { color: '#2563eb', weight: 4, opacity: 0.8 }
        );
        polyline.addTo(map);
        routeLayerRef.current = polyline;

        // Ajuster la vue pour voir tout l'itinéraire
        map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
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

  // Charger les points d'eau le long du tracé — sur toute l'emprise du parcours (pas seulement
  // le viewport courant), dès qu'un itinéraire existe, indépendamment du calque "Points d'eau".
  // Débounce pour éviter une requête Overpass à chaque point ajouté / chaque cran du slider.
  useEffect(() => {
    if (routePoints.length < 2) {
      setRouteWaterPoints([]);
      setIsLoadingRouteWater(false);
      return;
    }

    let cancelled = false;
    // Visible dès le changement (pas seulement après le debounce) : le fallback Overpass
    // direct (quand le proxy Edge Function est indisponible) peut prendre plusieurs dizaines
    // de secondes — sans indicateur, ça se voit comme "aucun point d'eau trouvé".
    setIsLoadingRouteWater(true);
    const timer = setTimeout(() => {
      const bounds = getRouteBounds(routePoints, maxDistanceFromRoute / 1000);
      fetchWaterPoints(bounds)
        .then(points => {
          if (!cancelled) setRouteWaterPoints(points);
        })
        .catch(() => {
          // Tracé trop long / API indisponible : on garde simplement les spots de bivouac,
          // les points d'eau du calque viewport (s'il est actif) restent affichés.
          if (!cancelled) setRouteWaterPoints([]);
        })
        .finally(() => {
          if (!cancelled) setIsLoadingRouteWater(false);
        });
    }, 800);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [routePoints, maxDistanceFromRoute]);

  // Points d'eau du tracé effectivement à moins de `maxDistanceFromRoute` de l'itinéraire,
  // triés par proximité et plafonnés : un long tracé en zone alpine peut retourner des
  // centaines de plans d'eau OSM, autant de marqueurs DOM individuels ferait le même genre
  // de blocage navigateur que l'import GPX dense (cf. gpx-kml-parser.ts).
  const routeFilteredWaterPoints = useMemo(() => {
    if (routePoints.length < 2 || routeWaterPoints.length === 0) return [];
    return routeWaterPoints
      .map(wp => ({ wp, dist: distanceToRoute({ lat: wp.lat, lng: wp.lng }, routePoints) }))
      .filter(({ dist }) => dist <= maxDistanceFromRoute / 1000)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, MAX_ROUTE_WATER_MARKERS)
      .map(({ wp }) => wp);
  }, [routeWaterPoints, routePoints, maxDistanceFromRoute]);

  const onNearbyWaterCountChangeRef = useRef(onNearbyWaterCountChange);
  onNearbyWaterCountChangeRef.current = onNearbyWaterCountChange;

  useEffect(() => {
    onNearbyWaterCountChangeRef.current?.(routeFilteredWaterPoints.length);
  }, [routeFilteredWaterPoints]);

  const onRouteWaterLoadingChangeRef = useRef(onRouteWaterLoadingChange);
  onRouteWaterLoadingChangeRef.current = onRouteWaterLoadingChange;

  useEffect(() => {
    onRouteWaterLoadingChangeRef.current?.(isLoadingRouteWater);
  }, [isLoadingRouteWater]);

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
  const viewportFilteredWaterPoints = useMemo(() => {
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

  // Fusion avec les points d'eau du tracé (dédoublonnés par id) : le calque viewport et le
  // tracé sont deux sources indépendantes, toutes deux affichées quand elles sont actives.
  const filteredWaterPoints = useMemo(() => {
    if (routeFilteredWaterPoints.length === 0) return viewportFilteredWaterPoints;

    const seenIds = new Set(viewportFilteredWaterPoints.map(wp => wp.id));
    const merged = [...viewportFilteredWaterPoints];
    for (const wp of routeFilteredWaterPoints) {
      if (!seenIds.has(wp.id)) {
        seenIds.add(wp.id);
        merged.push(wp);
      }
    }
    return merged;
  }, [viewportFilteredWaterPoints, routeFilteredWaterPoints]);

  // Afficher les marqueurs de points d'eau
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Nettoyer les anciens marqueurs
    waterMarkersRef.current.forEach(marker => marker.remove());
    waterMarkersRef.current = [];

    // Afficher si le calque "Points d'eau" est actif OU si un tracé est en cours
    // (les points d'eau du tracé s'affichent indépendamment du calque)
    if (!showWaterPoints && routePoints.length < 2) return;

    // Ajouter les nouveaux marqueurs (limités et triés)
    filteredWaterPoints.forEach((waterPoint) => {
      // Les cours d'eau ne sont pas affichés (utilisés uniquement pour la proximité)
      if (waterPoint.waterType === 'stream') return;

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

      const isSelected = selectedWaterPoint?.id === waterPoint.id;

      const marker = L.marker([waterPoint.lat, waterPoint.lng], {
        icon: isSelected ? selectedWaterIcon : customIcon,
        zIndexOffset: -100, // Afficher sous les marqueurs de bivouac
      });

      marker.on('click', () => onWaterPointClick?.(waterPoint));
      marker.addTo(map);
      waterMarkersRef.current.push(marker);
    });
  }, [filteredWaterPoints, showWaterPoints, routePoints.length, onWaterPointClick, selectedWaterPoint]);

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

      // Rendu multi-ring : chaque anneau disjoint devient un polygone séparé
      const allRings = area.rings || [area.geometry];
      const polygonStyle = {
        color: areaColor,
        weight: isAreaSelected ? 3 : 2,
        opacity: 0.8,
        fillColor: areaColor,
        fillOpacity: areaFillOpacity,
        interactive: true,
      };

      allRings.forEach(ring => {
        const polygon = L.polygon(
          ring.map(point => [point.lat, point.lng] as [number, number]),
          polygonStyle
        );

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

      const zoneFillOpacity = isZoneSelected ? 0.15 : 0.25;
      const polygonStyle = {
        color,
        weight: isZoneSelected ? 3 : 2,
        opacity: 0.9,
        fillColor: color,
        fillOpacity: zoneFillOpacity,
        interactive: true,
      };

      // Extraire les anneaux selon le type GeoJSON (Polygon ou MultiPolygon)
      const rings: [number, number][][] = geom.type === 'Polygon'
        ? [geom.coordinates[0].map((c: [number, number]) => [c[1], c[0]])]
        : geom.type === 'MultiPolygon'
          ? (geom as GeoJSON.MultiPolygon).coordinates.map(poly => poly[0].map((c: [number, number]) => [c[1], c[0]]))
          : [];

      rings.forEach(ring => {
        if (ring.length < 3) return;
        const polygon = L.polygon(ring as [number, number][], polygonStyle);

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

      {/* Retour live sur la surface de la zone d'un spot en cours de tracé */}
      {isDrawingMode && poiZoneAreaLimitM2 != null && liveDrawAreaM2 !== null && (
        <div className={`absolute left-1/2 -translate-x-1/2 top-6 z-[1050] rounded-lg shadow-lg px-4 py-2 font-medium text-sm ${
          liveDrawAreaM2 > poiZoneAreaLimitM2 ? 'bg-red-50 text-red-800 border-l-4 border-red-400' : 'bg-white text-gray-800'
        }`}>
          Surface de la zone : {Math.round(liveDrawAreaM2)} m² / {poiZoneAreaLimitM2} m² max
        </div>
      )}

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
      
      {/* Carte info Nivose sélectionnée — données capteur réelles Météo-France */}
      {selectedNivose && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-[450] bg-white rounded-xl shadow-2xl overflow-hidden pointer-events-auto" style={{ width: 320 }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#374151] border-2 border-white flex items-center justify-center flex-shrink-0" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-800">{selectedNivose.name}</div>
                <div className="text-xs text-gray-400">{selectedNivose.altitude} m · {selectedNivose.region}</div>
              </div>
            </div>
            <button onClick={() => setSelectedNivose(null)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors text-gray-400">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-3 py-3 space-y-3">
            {(() => {
              // ── helper : graphique SVG sparkline avec axes ──────────────────
              const NivoChart = ({
                pts, color, label, unit, yMin, yMax, showZero,
              }: {
                pts: (number | null)[]; color: string; label: string; unit: string;
                yMin: number; yMax: number; showZero?: boolean;
              }) => {
                const W = 292, H = 60, PAD = 4;
                const range = yMax - yMin || 1;
                const valid = pts.filter((v): v is number => v !== null);
                if (valid.length < 2) return null;
                const latest = valid[valid.length - 1];
                const toY = (v: number) => PAD + (1 - (v - yMin) / range) * (H - PAD * 2);
                const polyPts = pts
                  .map((v, i) => v !== null ? `${(i / (pts.length - 1)) * W},${toY(v)}` : null)
                  .filter(Boolean).join(' ');
                const zeroY = toY(0);
                return (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-500">{label}</span>
                      <span className="text-xs font-semibold" style={{ color }}>
                        {latest % 1 === 0 ? latest : latest.toFixed(1)} {unit}
                      </span>
                    </div>
                    <div className="rounded-lg overflow-hidden bg-gray-50">
                      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }} preserveAspectRatio="none">
                        {/* grid lines */}
                        <line x1="0" y1={toY(yMax)} x2={W} y2={toY(yMax)} stroke="#f3f4f6" strokeWidth="1" />
                        <line x1="0" y1={toY((yMax + yMin) / 2)} x2={W} y2={toY((yMax + yMin) / 2)} stroke="#f3f4f6" strokeWidth="1" />
                        <line x1="0" y1={toY(yMin)} x2={W} y2={toY(yMin)} stroke="#f3f4f6" strokeWidth="1" />
                        {/* zero line for temp */}
                        {showZero && yMin < 0 && yMax > 0 && (
                          <line x1="0" y1={zeroY} x2={W} y2={zeroY} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="3,2" />
                        )}
                        {/* data */}
                        <polyline points={polyPts} fill="none" stroke={color} strokeWidth="1.8"
                          strokeLinejoin="round" strokeLinecap="round" />
                        {/* now marker */}
                        <line x1={W - 1} y1="0" x2={W - 1} y2={H} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3,2" />
                      </svg>
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-300 mt-0.5 px-0.5">
                      <span>−24 h</span><span>maintenant</span>
                    </div>
                  </div>
                );
              };

              // ── données disponibles via API ─────────────────────────────────
              if (nivoLoading) {
                return (
                  <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin flex-shrink-0" />
                    Chargement des observations…
                  </div>
                );
              }

              // L'API DPObs ne renvoie qu'une seule observation (pas d'historique) —
              // sans au moins 2 points pour tracer une courbe, on préfère le fallback GIF ci-dessous.
              const hasChartData = !!nivoObs && nivoObs.filter(o => o.tempC !== null).length >= 2;
              if (nivoObs && nivoObs.length > 0 && hasChartData) {
                const temps  = nivoObs.map(o => o.tempC);
                const winds  = nivoObs.map(o => o.windKph);
                const snows  = nivoObs.map(o => o.snowCm);
                const validTemps = temps.filter((v): v is number => v !== null);
                const validWinds = winds.filter((v): v is number => v !== null);
                const validSnows = snows.filter((v): v is number => v !== null);
                const hasSnow = validSnows.some(v => v > 0);
                return (
                  <>
                    {validTemps.length >= 2 && (
                      <NivoChart pts={temps} color="#3b82f6" label="Température" unit="°C"
                        yMin={Math.floor(Math.min(...validTemps) - 1)}
                        yMax={Math.ceil(Math.max(...validTemps) + 1)}
                        showZero />
                    )}
                    {validWinds.length >= 2 && (
                      <NivoChart pts={winds} color="#0891b2" label="Vent" unit="km/h"
                        yMin={0}
                        yMax={Math.ceil(Math.max(...validWinds, 10) * 1.15)} />
                    )}
                    {hasSnow && (
                      <NivoChart pts={snows} color="#94a3b8" label="Enneigement" unit="cm"
                        yMin={0}
                        yMax={Math.ceil(Math.max(...validSnows) * 1.15)} />
                    )}
                    <div className="text-[10px] text-green-600 bg-green-50 rounded px-2 py-1 leading-tight">
                      ✓ Données capteur réelles · Météo-France DPObs
                    </div>
                  </>
                );
              }

              // ── fallback GIF Météo-France ───────────────────────────────────
              if (selectedNivose.meteofCode) {
                return (
                  <>
                    <img
                      src={`https://rwg.meteofrance.com/internet2018client/2.0/files/mountain/observations/${selectedNivose.meteofCode}.gif`}
                      alt={`Observations nivose ${selectedNivose.name}`}
                      className="w-full rounded-lg"
                      style={{ display: 'block' }}
                    />
                    <div className="text-[10px] text-gray-400 text-center mt-1">
                      Source : Météo-France · capteur réel · mise à jour ~3 h
                    </div>
                    {nivoError && nivoError.includes('METEOFRANCE_OBS_KEY') && (
                      <div className="text-[10px] text-amber-500 bg-amber-50 rounded px-2 py-1 mt-1 leading-tight">
                        Graphiques désactivés — clé DPObs non configurée.{' '}
                        <a href="https://portail-api.meteofrance.fr/" target="_blank" rel="noopener noreferrer" className="underline">Obtenir une clé gratuite</a>
                      </div>
                    )}
                  </>
                );
              }

              return (
                <div className="py-4 text-center">
                  <div className="text-sm text-gray-500 mb-1">Données capteur non disponibles</div>
                  <div className="text-xs text-gray-400">Station non référencée dans la base Météo-France.</div>
                </div>
              );
            })()}
          </div>
          <a
            href="https://donneespubliques.meteofrance.fr/?fond=produit&id_produit=93&id_rubrique=34"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between text-xs text-gray-400 hover:text-blue-500 transition-colors px-4 py-2 border-t border-gray-50"
          >
            Voir les données Météo-France
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      )}

      {/* Légende radar précipitations — desktop (bottom-left) */}
      {showWeather && showStorms && (
        <div className="hidden md:block absolute bottom-11 left-6 z-[400] bg-white/90 backdrop-blur-sm rounded-xl shadow-xl w-52 overflow-hidden">
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
      {showWeather && showStorms && (
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
              {' · Contours des massifs : © OpenStreetMap contributors (ODbL)'}
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
          showWeather={showWeather}
          onWeatherToggle={onWeatherToggle}
          showWind={showWind}
          onWindToggle={onWindToggle}
          showStorms={showStorms}
          onStormsToggle={onStormsToggle}
          showNivoses={showNivoses}
          onNivosesToggle={onNivosesToggle}
          satelliteMode={satelliteMode}
          onSatelliteModeToggle={onSatelliteModeToggle || (() => {})}
          winterMode={winterMode}
          onWinterModeToggle={onWinterModeToggle}
        />
      )}
    </div>
  );
}