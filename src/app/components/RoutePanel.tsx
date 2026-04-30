import React from 'react';
import { X, Route, Trash2, Check, Zap } from 'lucide-react';

interface RoutePanelProps {
  onClose: () => void;
  isSmartRouting: boolean;
  onToggleSmartRouting: (value: boolean) => void;
  onClearRoute: () => void;
  onFinishRoute: () => void;
  routePointsCount: number;
  nearbyPoisCount: number;
  maxDistance: number;
  onMaxDistanceChange: (value: number) => void;
}

export function RoutePanel({
  onClose,
  isSmartRouting,
  onToggleSmartRouting,
  onClearRoute,
  onFinishRoute,
  routePointsCount,
  nearbyPoisCount,
  maxDistance,
  onMaxDistanceChange,
}: RoutePanelProps) {
  return (
    <>
      {/* Mobile: panneau du bas */}
      <div 
        className="md:hidden fixed inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl z-[1000]"
        style={{
          maxHeight: 'calc(100vh - 120px)',
          animation: 'slideUp 0.3s ease-out'
        }}
      >
        <style>{`
          @keyframes slideUp {
            from {
              transform: translateY(100%);
            }
            to {
              transform: translateY(0);
            }
          }
        `}</style>
        
        {/* Poignée de glissement */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Bouton fermer */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Contenu scrollable */}
        <div className="overflow-y-auto px-6 pb-6" style={{ maxHeight: 'calc(100vh - 180px)' }}>
          <PanelContent 
            isSmartRouting={isSmartRouting}
            onToggleSmartRouting={onToggleSmartRouting}
            onClearRoute={onClearRoute}
            onFinishRoute={onFinishRoute}
            routePointsCount={routePointsCount}
            nearbyPoisCount={nearbyPoisCount}
            maxDistance={maxDistance}
            onMaxDistanceChange={onMaxDistanceChange}
            onClose={onClose}
          />
        </div>
      </div>

      {/* Desktop: panneau latéral gauche */}
      <div 
        className="hidden md:block fixed top-[158px] left-6 w-[480px] bg-white shadow-2xl z-[500] rounded-b-xl"
        style={{
          animation: 'fadeIn 0.3s ease-out',
          maxHeight: 'calc(100vh - 10.5rem)'
        }}
      >
        <style>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
        `}</style>

        {/* Contenu scrollable */}
        <div className="overflow-y-auto px-6 py-6" style={{ maxHeight: 'calc(100vh - 10.5rem)' }}>
          <PanelContent 
            isSmartRouting={isSmartRouting}
            onToggleSmartRouting={onToggleSmartRouting}
            onClearRoute={onClearRoute}
            onFinishRoute={onFinishRoute}
            routePointsCount={routePointsCount}
            nearbyPoisCount={nearbyPoisCount}
            maxDistance={maxDistance}
            onMaxDistanceChange={onMaxDistanceChange}
            onClose={onClose}
          />
        </div>
      </div>
    </>
  );
}

function PanelContent({
  isSmartRouting,
  onToggleSmartRouting,
  onClearRoute,
  onFinishRoute,
  routePointsCount,
  nearbyPoisCount,
  maxDistance,
  onMaxDistanceChange,
  onClose,
}: {
  isSmartRouting: boolean;
  onToggleSmartRouting: (value: boolean) => void;
  onClearRoute: () => void;
  onFinishRoute: () => void;
  routePointsCount: number;
  nearbyPoisCount: number;
  maxDistance: number;
  onMaxDistanceChange: (value: number) => void;
  onClose?: () => void;
}) {
  return (
    <div>
      {/* En-tête avec titre et bouton fermer */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Route className="w-5 h-5 text-emerald-600" />
          <h2 className="text-xl font-bold text-gray-800 drop-shadow-sm">Tracer un itinéraire</h2>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-800" />
          </button>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-emerald-50 border-l-4 border-emerald-400 p-3 rounded-r-lg mb-4">
        <p className="text-sm text-emerald-800">
          Cliquez sur la carte pour placer des points et créer votre itinéraire. Les spots de bivouac proches seront automatiquement filtrés.
        </p>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-blue-50 rounded-lg p-3">
          <p className="text-xs text-blue-600 font-medium mb-1">Points d'itinéraire</p>
          <p className="text-2xl font-bold text-blue-700">{routePointsCount}</p>
        </div>
        <div className="bg-emerald-50 rounded-lg p-3">
          <p className="text-xs text-emerald-600 font-medium mb-1">Spots à proximité</p>
          <p className="text-2xl font-bold text-emerald-700">{nearbyPoisCount}</p>
        </div>
      </div>

      {/* Toggle mode de routage */}
      <div className="mb-4">
        <label className="flex items-center gap-3 cursor-pointer p-3 border-2 border-gray-300 rounded-lg hover:border-emerald-300 transition-colors bg-white">
          <input
            type="checkbox"
            checked={isSmartRouting}
            onChange={(e) => onToggleSmartRouting(e.target.checked)}
            className="w-5 h-5 text-emerald-600 rounded focus:ring-2 focus:ring-emerald-500"
          />
          <div className="flex items-center gap-2 flex-1">
            <Zap className="w-5 h-5 text-emerald-600" />
            <div>
              <span className="font-medium text-gray-800 block">Tracé intelligent</span>
              <span className="text-xs text-gray-600">Suit les chemins sur la carte</span>
            </div>
          </div>
        </label>
        {!isSmartRouting && (
          <p className="text-xs text-gray-500 mt-2 ml-3">
            Mode simple : ligne droite entre les points
          </p>
        )}
      </div>

      {/* Distance maximale */}
      <div className="mb-4">
        <label className="block text-sm font-semibold mb-2 text-gray-800">
          Distance maximale de l'itinéraire
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0.5"
            max="10"
            step="0.5"
            value={maxDistance}
            onChange={(e) => onMaxDistanceChange(parseFloat(e.target.value))}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
          />
          <span className="text-sm font-medium text-gray-700 w-16 text-right">
            {maxDistance} km
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Affiche les spots à moins de {maxDistance} km de l'itinéraire
        </p>
      </div>

      {/* Boutons d'action */}
      <div className="flex gap-3">
        <button
          onClick={onClearRoute}
          disabled={routePointsCount === 0}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <Trash2 className="w-5 h-5" />
          <span className="font-medium">Effacer</span>
        </button>
        <button
          onClick={onFinishRoute}
          disabled={routePointsCount < 2}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
        >
          <Check className="w-5 h-5" />
          <span className="font-medium">Terminer</span>
        </button>
      </div>
    </div>
  );
}
