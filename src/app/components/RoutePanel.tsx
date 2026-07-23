import React, { useState } from 'react';
import { Route, RotateCcw, Undo2, Check, Zap, Save, Tent, Droplets } from 'lucide-react';
import { Panel } from './ui/bivouac-panel';
import { BivouacButton } from './ui/bivouac-button';
import { StatBadge } from './ui/bivouac-badge';
import { RangeSlider } from './ui/bivouac-input';
import { TripNamePrompt } from './TripNamePrompt';
import { useAuth } from '../contexts/AuthContext';

interface RoutePanelProps {
  onClose: () => void;
  isSmartRouting: boolean;
  onToggleSmartRouting: (value: boolean) => void;
  onClearRoute: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onFinishRoute: () => void;
  routePointsCount: number;
  nearbyPoisCount: number;
  nearbyWaterCount: number;
  isLoadingWaterCount?: boolean;
  maxDistance: number;
  onMaxDistanceChange: (value: number) => void;
  // Nom de la trace chargée si l'itinéraire courant correspond à une trace enregistrée
  // (import ou tracé) — détermine si "Enregistrer" doit créer une nouvelle trace ou
  // mettre à jour celle-ci.
  activeTripName?: string | null;
  onSaveRoute?: (name: string) => Promise<void>;
  onUpdateRoute?: () => Promise<void>;
}

export function RoutePanel({
  onClose,
  isSmartRouting,
  onToggleSmartRouting,
  onClearRoute,
  onUndo,
  canUndo,
  onFinishRoute,
  routePointsCount,
  nearbyPoisCount,
  nearbyWaterCount,
  isLoadingWaterCount = false,
  maxDistance,
  onMaxDistanceChange,
  activeTripName,
  onSaveRoute,
  onUpdateRoute,
}: RoutePanelProps) {
  const { currentUser } = useAuth();
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

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

  const handleUpdate = async () => {
    if (!onUpdateRoute) return;
    setIsUpdating(true);
    try {
      await onUpdateRoute();
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Panel
      onClose={onClose}
      title="Tracer un itinéraire"
      icon={<Route className="w-5 h-5" />}
    >
      {/* Statistiques */}
      <div className="flex flex-wrap gap-2 mb-4">
        <StatBadge icon={<Route className="w-3.5 h-3.5" />} label="Points d'itinéraire" value={routePointsCount} variant="blue" />
        <StatBadge icon={<Tent className="w-3.5 h-3.5" />} label="Spots à proximité" value={nearbyPoisCount} variant="emerald" />
        <StatBadge
          icon={<Droplets className="w-3.5 h-3.5" />}
          label="Points d'eau à proximité"
          value={isLoadingWaterCount ? 'Recherche…' : nearbyWaterCount}
          variant="blue"
        />
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
          min="50"
          max="400"
          step="25"
          value={maxDistance}
          onChange={(e) => onMaxDistanceChange(parseFloat(e.target.value))}
          unit="m"
          displayValue={maxDistance}
        />
        <p className="text-xs text-gray-500 mt-1">
          Affiche les spots à moins de {maxDistance} m de l'itinéraire
        </p>
      </div>

      {/* Enregistrer le tracé — réservé aux utilisateurs connectés */}
      {currentUser && (onSaveRoute || onUpdateRoute) && (
        <div className="mb-4">
          {activeTripName && onUpdateRoute ? (
            <BivouacButton
              variant="secondary"
              icon={<Save className="w-4 h-4" />}
              onClick={handleUpdate}
              disabled={routePointsCount < 2 || isUpdating}
              className="w-full py-2.5"
            >
              {isUpdating ? 'Mise à jour…' : `Mettre à jour « ${activeTripName} »`}
            </BivouacButton>
          ) : showNamePrompt ? (
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
      <div className="flex gap-2">
        <BivouacButton
          variant="ghost"
          icon={<Undo2 className="w-4 h-4" />}
          onClick={onUndo}
          disabled={!canUndo}
          title="Annuler la dernière action"
          className="px-3 py-2.5 border border-gray-200"
        />
        <BivouacButton
          variant="outline"
          icon={<RotateCcw className="w-4 h-4" />}
          onClick={onClearRoute}
          disabled={routePointsCount === 0}
          title="Réinitialise la vue sans supprimer une trace déjà enregistrée"
          className="flex-1 py-2.5"
        >
          Réinitialiser
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
