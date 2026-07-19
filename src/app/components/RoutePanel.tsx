import React, { useState } from 'react';
import { Route, Trash2, Check, Zap, Save } from 'lucide-react';
import { Panel } from './ui/bivouac-panel';
import { BivouacButton } from './ui/bivouac-button';
import { AlertCard, InfoCard } from './ui/bivouac-card';
import { RangeSlider } from './ui/bivouac-input';
import { TripNamePrompt } from './TripNamePrompt';
import { useAuth } from '../contexts/AuthContext';

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
  onSaveRoute?: (name: string) => Promise<void>;
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
  onSaveRoute,
}: RoutePanelProps) {
  const { currentUser } = useAuth();
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleConfirmSave = async (name: string) => {
    if (!onSaveRoute) return;
    setIsSaving(true);
    try {
      await onSaveRoute(name);
      setShowNamePrompt(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Panel
      onClose={onClose}
      title="Tracer un itinéraire"
      icon={<Route className="w-5 h-5" />}
    >
      {/* Instructions */}
      <AlertCard type="success" className="mb-4">
        <p className="text-sm">
          Cliquez sur la carte pour placer des points. Les spots de bivouac proches seront
          automatiquement filtrés.
        </p>
      </AlertCard>

      {/* Statistiques */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <InfoCard title="Points d'itinéraire" value={routePointsCount} variant="blue" />
        <InfoCard title="Spots à proximité" value={nearbyPoisCount} variant="emerald" />
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
        <RangeSlider
          label="Distance maximale de l'itinéraire"
          min="0.5"
          max="10"
          step="0.5"
          value={maxDistance}
          onChange={(e) => onMaxDistanceChange(parseFloat(e.target.value))}
          unit="km"
          displayValue={maxDistance}
        />
        <p className="text-xs text-gray-500 mt-1">
          Affiche les spots à moins de {maxDistance} km de l'itinéraire
        </p>
      </div>

      {/* Enregistrer le tracé — réservé aux utilisateurs connectés */}
      {currentUser && onSaveRoute && (
        <div className="mb-4">
          {showNamePrompt ? (
            <TripNamePrompt
              onConfirm={handleConfirmSave}
              onCancel={() => setShowNamePrompt(false)}
              isSubmitting={isSaving}
            />
          ) : (
            <BivouacButton
              variant="secondary"
              icon={<Save className="w-4 h-4" />}
              onClick={() => setShowNamePrompt(true)}
              disabled={routePointsCount < 2}
              className="w-full py-2.5"
            >
              Enregistrer ce tracé
            </BivouacButton>
          )}
        </div>
      )}

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
