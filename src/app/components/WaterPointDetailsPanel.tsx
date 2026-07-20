import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Droplet, CheckCircle2, XCircle } from 'lucide-react';
import { Panel } from './ui/bivouac-panel';
import { BivouacButton } from './ui/bivouac-button';
import { WaterPoint, getWaterPointLabel, getWaterPointInfo } from '../services/overpass';
import { AuthUser } from '../../utils/supabase/auth';
import {
  WaterPointConfirmation,
  fetchWaterPointConfirmations,
  createWaterPointConfirmation,
} from '../../utils/supabase/water-point-confirmations-api';

interface WaterPointDetailsPanelProps {
  waterPoint: WaterPoint | null;
  onClose: () => void;
  currentUser: AuthUser | null;
  onLoginRequired: () => void;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatFrDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

export function WaterPointDetailsPanel({
  waterPoint,
  onClose,
  currentUser,
  onLoginRequired,
}: WaterPointDetailsPanelProps) {
  const [confirmations, setConfirmations] = useState<WaterPointConfirmation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmedOn, setConfirmedOn] = useState(todayIsoDate());
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!waterPoint) return;
    setConfirmedOn(todayIsoDate());
    setIsLoading(true);
    fetchWaterPointConfirmations(waterPoint.id)
      .then(setConfirmations)
      .finally(() => setIsLoading(false));
  }, [waterPoint?.id]);

  if (!waterPoint) return null;

  const info = getWaterPointInfo(waterPoint);
  const isNatural = waterPoint.waterType === 'uncontrolled_water';
  const iconColor = isNatural ? 'text-teal-600' : 'text-sky-600';
  const latest = confirmations[0];

  const handleConfirm = async (isValid: boolean) => {
    if (!currentUser) {
      onLoginRequired();
      return;
    }
    setIsSubmitting(true);
    try {
      const created = await createWaterPointConfirmation(waterPoint.id, isValid, confirmedOn);
      setConfirmations(prev => [created, ...prev]);
      toast.success('Confirmation enregistrée, merci !');
    } catch (error) {
      console.error('Error creating water point confirmation:', error);
      toast.error('Impossible d\'enregistrer votre confirmation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Panel
      onClose={onClose}
      title={getWaterPointLabel(waterPoint)}
      icon={<Droplet className={`w-5 h-5 ${iconColor}`} />}
    >
      {info.length > 0 && (
        <ul className="mb-2 text-sm text-gray-700 space-y-1">
          {info.map((i, idx) => <li key={idx}>{i}</li>)}
        </ul>
      )}
      <p className="mb-4 text-xs text-gray-400">Source : OpenStreetMap</p>

      <div className="mb-4 bg-sky-50 rounded-lg p-4">
        {isLoading ? (
          <p className="text-sm text-gray-500">Chargement…</p>
        ) : (
          <>
            {latest ? (
              <p className="flex items-center gap-1.5 text-sm text-gray-700 mb-2">
                {latest.is_valid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                )}
                Dernière confirmation : {latest.is_valid ? 'actif' : 'inactif'} — le {formatFrDate(latest.confirmed_on)}
              </p>
            ) : (
              <p className="text-sm text-gray-500 mb-2">Personne n'a encore confirmé ce point d'eau.</p>
            )}

            {confirmations.length > 1 && (
              <ul className="mb-3 text-xs text-gray-500 space-y-1">
                {confirmations.slice(1, 5).map((c) => (
                  <li key={c.id} className="flex items-center gap-1.5">
                    {c.is_valid ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                    )}
                    {c.is_valid ? 'Actif' : 'Inactif'} — {formatFrDate(c.confirmed_on)}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {currentUser ? (
          <div>
            <p className="text-sm text-gray-600 mb-2">Ce point d'eau est-il toujours valable ?</p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={confirmedOn}
                max={todayIsoDate()}
                onChange={(e) => setConfirmedOn(e.target.value)}
                className="text-sm rounded-md border border-gray-200 px-2 py-1.5 focus:ring-1 focus:ring-sky-400"
              />
              <BivouacButton
                variant="primary"
                size="sm"
                icon={<CheckCircle2 className="w-4 h-4" />}
                onClick={() => handleConfirm(true)}
                disabled={isSubmitting}
              >
                Actif
              </BivouacButton>
              <BivouacButton
                variant="destructive"
                size="sm"
                icon={<XCircle className="w-4 h-4" />}
                onClick={() => handleConfirm(false)}
                disabled={isSubmitting}
              >
                Inactif
              </BivouacButton>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-gray-600">Connectez-vous pour confirmer ce point d'eau.</p>
            <BivouacButton variant="secondary" size="sm" onClick={onLoginRequired}>
              Se connecter
            </BivouacButton>
          </div>
        )}
      </div>
    </Panel>
  );
}
