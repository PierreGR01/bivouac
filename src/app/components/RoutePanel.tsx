import React from 'react';
import { Route, Trash2, Check, Zap } from 'lucide-react';
import { Panel } from './ui/bivouac-panel';
import { BivouacButton } from './ui/bivouac-button';

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
    <Panel
      onClose={onClose}
      title="Tracer un itinéraire"
      icon={<Route className="w-5 h-5" />}
    >
      {/* Instructions */}
      <div className="bg-emerald-50 border-l-4 border-emerald-400 p-3 rounded-r-lg mb-4">
        <p className="text-sm text-emerald-800">
          Cliquez sur la carte pour placer des points. Les spots de bivouac proches seront
          automatiquement filtrés.
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
        <label className="flex items-center gap-3 cursor-pointer p-3 border border-gray-200 rounded-lg hover:border-emerald-300 transition-colors bg-white">
          <input
            type="checkbox"
            checked={isSmartRouting}
            onChange={(e) => onToggleSmartRouting(e.target.checked)}
            className="w-5 h-5 text-emerald-600 rounded focus:ring-2 focus:ring-emerald-500"
          />
          <div className="flex items-center gap-2 flex-1">
            <Zap className="w-5 h-5 text-emerald-600" />
            <div>
              <span className="font-medium text-gray-800 block text-sm">Tracé intelligent</span>
              <span className="text-xs text-gray-500">Suit les chemins sur la carte</span>
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
      <div className="mb-5">
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

      {/* Actions */}
      <div className="flex gap-3">
        <BivouacButton
          variant="destructive"
          icon={<Trash2 className="w-4 h-4" />}
          onClick={onClearRoute}
          disabled={routePointsCount === 0}
          className="flex-1 py-2.5"
        >
          Effacer
        </BivouacButton>
        <BivouacButton
          variant="primary"
          icon={<Check className="w-4 h-4" />}
          onClick={onFinishRoute}
          disabled={routePointsCount < 2}
          className="flex-1 py-2.5"
        >
          Terminer
        </BivouacButton>
      </div>
    </Panel>
  );
}
