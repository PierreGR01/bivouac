import React from 'react';
import { Droplet, BanIcon, Route, Plus, Minus, Ruler, Snowflake, Locate, Settings, CloudRain, Zap } from 'lucide-react';

interface MapControlsProps {
  showWaterPoints: boolean;
  onWaterPointsToggle: () => void;
  showProtectedAreas: boolean;
  onProtectedAreasToggle: () => void;
  onRouteClick: () => void;
  isRoutingMode: boolean;
  isMeasuringMode: boolean;
  onMeasureClick: () => void;
  showRainRadar?: boolean;
  onRainRadarToggle?: () => void;
  showLightning?: boolean;
  onLightningToggle?: () => void;
  satelliteMode: boolean;
  onSatelliteModeToggle: () => void;
  winterMode?: boolean;
  onWinterModeToggle?: () => void;
  isAdmin?: boolean;
  showCustomZonesEditor?: boolean;
  onCustomZonesToggle?: () => void;
}

export function MapControls({
  showWaterPoints,
  onWaterPointsToggle,
  showProtectedAreas,
  onProtectedAreasToggle,
  onRouteClick,
  isRoutingMode,
  isMeasuringMode,
  onMeasureClick,
  satelliteMode,
  showRainRadar = false,
  onRainRadarToggle,
  showLightning = false,
  onLightningToggle,
  onSatelliteModeToggle,
  winterMode = false,
  onWinterModeToggle,
  isAdmin = false,
  showCustomZonesEditor = false,
  onCustomZonesToggle
}: MapControlsProps) {
  const handleZoomIn = () => {
    (window as any).__mapZoomIn?.();
  };

  const handleZoomOut = () => {
    (window as any).__mapZoomOut?.();
  };

  const handleLocate = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          // Appeler la fonction globale pour recentrer la carte
          (window as any).__mapCenterTo?.(latitude, longitude);
        },
        (error) => {
          console.error('Erreur de géolocalisation:', error);
          alert('Impossible d\'accéder à votre position. Vérifiez les permissions de localisation.');
        }
      );
    } else {
      alert('La géolocalisation n\'est pas supportée par votre navigateur.');
    }
  };

  return (
    <div className="flex absolute bottom-6 right-6 z-[400] bg-white rounded-xl shadow-xl p-2 flex-col gap-2">
      {/* Bouton itinéraire */}
      <button
        onClick={onRouteClick}
        className={`w-10 h-10 rounded-lg transition-all flex items-center justify-center ${
          isRoutingMode 
            ? 'bg-blue-600 text-white' 
            : 'text-gray-700 hover:bg-gray-100'
        }`}
        title="Mode itinéraire"
      >
        <Route className="w-5 h-5" />
      </button>

      {/* Bouton règle */}
      <button
        onClick={onMeasureClick}
        className={`w-10 h-10 rounded-lg transition-all flex items-center justify-center ${
          isMeasuringMode 
            ? 'bg-purple-600 text-white' 
            : 'text-gray-700 hover:bg-gray-100'
        }`}
        title="Outil de mesure"
      >
        <Ruler className="w-5 h-5" />
      </button>

      {/* Séparateur */}
      <div className="h-px bg-gray-200 my-1"></div>

      {/* Toggle zones interdites */}
      <button
        onClick={onProtectedAreasToggle}
        className={`w-10 h-10 rounded-lg transition-all flex items-center justify-center ${
          showProtectedAreas 
            ? 'bg-red-600 text-white' 
            : 'text-gray-700 hover:bg-gray-100'
        }`}
        title="Zones réglementées"
      >
        <BanIcon className="w-5 h-5" />
      </button>

      {/* Toggle points d'eau */}
      <button
        onClick={onWaterPointsToggle}
        className={`w-10 h-10 rounded-lg transition-all flex items-center justify-center ${
          showWaterPoints 
            ? 'bg-sky-600 text-white' 
            : 'text-gray-700 hover:bg-gray-100'
        }`}
        title="Points d'eau"
      >
        <Droplet className="w-5 h-5" />
      </button>

      {/* Séparateur */}
      <div className="h-px bg-gray-200 my-1"></div>

      {/* Météo — radar pluie */}
      <button
        onClick={onRainRadarToggle}
        className={`w-10 h-10 rounded-lg transition-all flex items-center justify-center ${
          showRainRadar
            ? 'bg-cyan-600 text-white'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
        title="Radar précipitations"
      >
        <CloudRain className="w-5 h-5" />
      </button>

      {/* Météo — foudre */}
      <button
        onClick={onLightningToggle}
        className={`w-10 h-10 rounded-lg transition-all flex items-center justify-center ${
          showLightning
            ? 'bg-amber-500 text-white'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
        title="Points de foudre"
      >
        <Zap className="w-5 h-5" />
      </button>

      {/* Séparateur */}
      <div className="h-px bg-gray-200 my-1"></div>

      {/* Bouton vue satellite */}
      <button
        onClick={onSatelliteModeToggle}
        className={`w-10 h-10 rounded-lg transition-all flex items-center justify-center ${
          satelliteMode 
            ? 'bg-emerald-700 text-white' 
            : 'text-gray-700 hover:bg-gray-100'
        }`}
        title={satelliteMode ? 'Vue topographique' : 'Vue satellite'}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {/* Bouton mode hiver */}
      {onWinterModeToggle && (
        <button
          onClick={onWinterModeToggle}
          className={`w-10 h-10 rounded-lg transition-all flex items-center justify-center ${
            winterMode
              ? 'bg-blue-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
          title={winterMode ? 'Désactiver le mode hiver' : 'Activer le mode hiver'}
        >
          <Snowflake className="w-5 h-5" />
        </button>
      )}

      {/* Admin: Créer des zones réglementées */}
      {isAdmin && onCustomZonesToggle && (
        <button
          onClick={onCustomZonesToggle}
          className={`w-10 h-10 rounded-lg transition-all flex items-center justify-center ${
            showCustomZonesEditor
              ? 'bg-purple-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
          title="Créer une zone réglementée"
        >
          <Settings className="w-5 h-5" />
        </button>
      )}

      {/* Séparateur */}
      <div className="h-px bg-gray-200 my-1"></div>

      {/* Contrôles de zoom */}
      <button
        onClick={handleZoomIn}
        className="w-10 h-10 rounded-lg text-gray-700 hover:bg-gray-100 transition-all flex items-center justify-center"
        title="Zoom avant"
      >
        <Plus className="w-5 h-5" />
      </button>

      <button
        onClick={handleZoomOut}
        className="w-10 h-10 rounded-lg text-gray-700 hover:bg-gray-100 transition-all flex items-center justify-center"
        title="Zoom arrière"
      >
        <Minus className="w-5 h-5" />
      </button>

      {/* Bouton localisation */}
      <button
        onClick={handleLocate}
        className="w-10 h-10 rounded-lg text-gray-700 hover:bg-gray-100 transition-all flex items-center justify-center"
        title="Ma position"
      >
        <Locate className="w-5 h-5" />
      </button>
    </div>
  );
}