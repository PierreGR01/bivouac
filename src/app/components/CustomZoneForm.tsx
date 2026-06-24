import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { createCustomZone, updateCustomZone, deleteCustomZone, CustomZone } from '../../utils/supabase/custom-zones-api';
import { hideOsmZone } from '../../utils/supabase/hidden-osm-zones-api';
import { fetchOsmZoneById } from '../services/protected-areas';
import { BivouacButton } from './ui/bivouac-button';

interface CustomZoneFormProps {
  geometry: GeoJSON.Feature;
  onClose: () => void;
  onSuccess: () => void;
  zone?: CustomZone;
  osmZoneId?: string;
  prefill?: { name?: string };
  onRegisterRequestClose?: (fn: () => void) => void;
}

const RESTRICTION_OPTIONS = [
  { value: 'camping_forbidden', label: 'Camping interdit' },
  { value: 'bivouac_forbidden', label: 'Bivouac interdit' },
  { value: 'fire_forbidden', label: 'Tout type de feux interdits' },
];

function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 ${
        enabled ? 'bg-emerald-600' : 'bg-gray-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
        enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
      }`} />
    </button>
  );
}

export function CustomZoneForm({ geometry, onClose, onSuccess, zone, osmZoneId, prefill, onRegisterRequestClose }: CustomZoneFormProps) {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = !!zone;
  const isOsmZone = !!osmZoneId;
  const isExistingZone = isEditing || isOsmZone;

  const initial = useMemo(() => ({
    name: zone?.name ?? prefill?.name ?? '',
    description: zone?.description ?? '',
    restrictionTypes: zone?.restriction_types ?? ['camping_forbidden'],
    sourceUrl: zone?.source_url ?? '',
    osmSourceId: zone?.osm_source_id ?? '',
    timeRangeEnabled: !!(zone?.time_range_start),
    timeRangeStart: zone?.time_range_start ?? '09:00',
    timeRangeEnd: zone?.time_range_end ?? '19:00',
    periodEnabled: !!(zone?.period_start),
    periodStart: zone?.period_start ?? '',
    periodEnd: zone?.period_end ?? '',
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [restrictionTypes, setRestrictionTypes] = useState<string[]>(initial.restrictionTypes);
  const [sourceUrl, setSourceUrl] = useState(initial.sourceUrl);
  const [osmSourceId, setOsmSourceId] = useState(initial.osmSourceId);

  const [timeRangeEnabled, setTimeRangeEnabled] = useState(initial.timeRangeEnabled);
  const [timeRangeStart, setTimeRangeStart] = useState(initial.timeRangeStart);
  const [timeRangeEnd, setTimeRangeEnd] = useState(initial.timeRangeEnd);

  const [periodEnabled, setPeriodEnabled] = useState(initial.periodEnabled);
  const [periodStart, setPeriodStart] = useState(initial.periodStart);
  const [periodEnd, setPeriodEnd] = useState(initial.periodEnd);

  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [osmResetStatus, setOsmResetStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [osmResetError, setOsmResetError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  const isDirty = isExistingZone && (
    name !== initial.name
    || description !== initial.description
    || JSON.stringify([...restrictionTypes].sort()) !== JSON.stringify([...initial.restrictionTypes].sort())
    || sourceUrl !== initial.sourceUrl
    || osmSourceId !== initial.osmSourceId
    || timeRangeEnabled !== initial.timeRangeEnabled
    || timeRangeStart !== initial.timeRangeStart
    || timeRangeEnd !== initial.timeRangeEnd
    || periodEnabled !== initial.periodEnabled
    || periodStart !== initial.periodStart
    || periodEnd !== initial.periodEnd
  );

  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const handleRequestClose = useCallback(() => {
    if (isDirtyRef.current) {
      setShowConfirmClose(true);
    } else {
      onCloseRef.current();
    }
  }, []);

  useEffect(() => {
    onRegisterRequestClose?.(handleRequestClose);
  }, [handleRequestClose, onRegisterRequestClose]);

  const handleRestrictionToggle = (value: string) => {
    setRestrictionTypes(prev =>
      prev.includes(value) ? prev.filter(r => r !== value) : [...prev, value]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Le nom de la zone est obligatoire');
      return;
    }
    if (restrictionTypes.length === 0) {
      setError('Sélectionnez au moins un type de restriction');
      return;
    }
    if (periodEnabled && (!periodStart.trim() || !periodEnd.trim())) {
      setError('Saisissez les dates de début et de fin de la période (JJ/MM)');
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        geometry,
        restriction_types: restrictionTypes,
        source_url: sourceUrl.trim() || undefined,
        osm_source_id: osmSourceId.trim() || undefined,
        time_range_start: timeRangeEnabled ? timeRangeStart : undefined,
        time_range_end: timeRangeEnabled ? timeRangeEnd : undefined,
        period_start: periodEnabled ? periodStart.trim() : undefined,
        period_end: periodEnabled ? periodEnd.trim() : undefined,
      };

      if (isEditing && zone) {
        await updateCustomZone(zone.id, payload);
      } else {
        await createCustomZone(payload);
        if (osmZoneId) {
          await hideOsmZone(osmZoneId, name.trim());
          await queryClient.invalidateQueries({ queryKey: ['hiddenOsmZones'] });
          await queryClient.invalidateQueries({ queryKey: ['protectedAreas'] });
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['customZones'] });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      if (isOsmZone && osmZoneId) {
        await hideOsmZone(osmZoneId, name.trim());
        await queryClient.invalidateQueries({ queryKey: ['hiddenOsmZones'] });
        await queryClient.invalidateQueries({ queryKey: ['protectedAreas'] });
      } else if (zone) {
        await deleteCustomZone(zone.id);
        await queryClient.invalidateQueries({ queryKey: ['customZones'] });
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
      setIsLoading(false);
    }
  };

  const handleResetFromOsm = async () => {
    const raw = osmSourceId.trim();
    if (!raw || !zone) return;
    const normalizedId = /^\d+$/.test(raw) ? `osm-relation-${raw}` : raw;
    setIsResetting(true);
    setOsmResetStatus('idle');
    setOsmResetError(null);
    try {
      const newGeometry = await fetchOsmZoneById(normalizedId);
      if (!newGeometry) throw new Error('Zone OSM introuvable — vérifier l\'ID');
      await updateCustomZone(zone.id, { geometry: newGeometry, osm_source_id: normalizedId });
      await queryClient.invalidateQueries({ queryKey: ['customZones'] });
      await queryClient.refetchQueries({ queryKey: ['customZones'] });
      setOsmResetStatus('success');
      setTimeout(() => onSuccess(), 1500);
    } catch (err) {
      const msg = err instanceof Error
        ? err.message
        : (err as any)?.message ?? (err as any)?.details ?? JSON.stringify(err);
      setOsmResetStatus('error');
      setOsmResetError(msg || 'Erreur lors de la mise à jour');
    } finally {
      setIsResetting(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';
  const smallInputClass = 'w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';

  return (
    <>
      <div
        className="fixed bottom-4 right-4 w-[22rem] bg-white rounded-lg shadow-2xl border border-gray-200 p-4 z-[9999] max-h-[90vh] overflow-y-auto"
        style={{ position: 'fixed', bottom: '16px', right: '16px', zIndex: 9999 }}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4 sticky top-0 bg-white pb-2 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800">
            {isExistingZone ? 'Modifier la zone réglementée' : 'Créer une zone réglementée'}
          </h3>
          <button onClick={handleRequestClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {error && (
          <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle size={15} className="flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nom */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la zone *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Parc national des Écrins"
              className={inputClass}
              disabled={isLoading}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contexte et détails de la restriction..."
              rows={2}
              className={inputClass}
              disabled={isLoading}
            />
          </div>

          {/* Types de restrictions */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Types de restrictions *
            </p>
            <div className="space-y-2">
              {RESTRICTION_OPTIONS.map(({ value, label }) => (
                <label key={value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={restrictionTypes.includes(value)}
                    onChange={() => handleRestrictionToggle(value)}
                    disabled={isLoading}
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Tranche horaire */}
          <div className="border border-gray-200 rounded-lg p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 leading-tight">
                Restriction sur une tranche horaire
              </span>
              <Toggle enabled={timeRangeEnabled} onChange={() => setTimeRangeEnabled(v => !v)} disabled={isLoading} />
            </div>
            {timeRangeEnabled && (
              <div className="flex items-end gap-2 pt-1">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">De</label>
                  <input type="time" value={timeRangeStart} onChange={(e) => setTimeRangeStart(e.target.value)} disabled={isLoading} className={smallInputClass} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">À</label>
                  <input type="time" value={timeRangeEnd} onChange={(e) => setTimeRangeEnd(e.target.value)} disabled={isLoading} className={smallInputClass} />
                </div>
              </div>
            )}
          </div>

          {/* Période de l'année */}
          <div className="border border-gray-200 rounded-lg p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 leading-tight">
                Restriction sur une période de l'année
              </span>
              <Toggle enabled={periodEnabled} onChange={() => setPeriodEnabled(v => !v)} disabled={isLoading} />
            </div>
            {periodEnabled && (
              <div className="flex items-end gap-2 pt-1">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Du (JJ/MM)</label>
                  <input
                    type="text"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    placeholder="01/05"
                    maxLength={5}
                    disabled={isLoading}
                    className={smallInputClass}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Au (JJ/MM)</label>
                  <input
                    type="text"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    placeholder="30/09"
                    maxLength={5}
                    disabled={isLoading}
                    className={smallInputClass}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Source officielle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source officielle (URL)</label>
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://..."
              className={inputClass}
              disabled={isLoading}
            />
          </div>

          {/* Mettre à jour depuis OSM — admin uniquement, zone existante */}
          {isEditing && (
            <div className="pt-2 border-t border-gray-100 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mettre à jour depuis OSM</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={osmSourceId}
                  onChange={e => { setOsmSourceId(e.target.value); setOsmResetStatus('idle'); setOsmResetError(null); }}
                  placeholder="ID OSM (ex: 1024508)"
                  className={`${inputClass} text-xs font-mono`}
                  disabled={isLoading || isResetting}
                />
                <BivouacButton
                  type="button"
                  variant="outline"
                  onClick={handleResetFromOsm}
                  disabled={isLoading || isResetting || !osmSourceId.trim()}
                  className="shrink-0 text-blue-700 border-blue-200 hover:bg-blue-50"
                >
                  {isResetting ? <Loader2 size={15} className="animate-spin" /> : 'Charger'}
                </BivouacButton>
              </div>
              {osmResetStatus === 'success' && (
                <p className="text-xs text-emerald-700 font-medium">✓ Tracé mis à jour sur la carte</p>
              )}
              {osmResetStatus === 'error' && osmResetError && (
                <p className="text-xs text-red-600 flex items-start gap-1">
                  <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                  {osmResetError}
                </p>
              )}
            </div>
          )}

          {/* Actions principales + Suppression */}
          <div className="pt-2 border-t border-gray-100">
            {confirmDelete ? (
              <div className="space-y-2">
                {isOsmZone && (
                  <div className="bg-red-50 border border-red-300 rounded-lg p-3">
                    <p className="text-sm text-red-800 font-bold">⚠️ Action irréversible</p>
                    <p className="text-xs text-red-700 mt-1">Cette zone OSM sera masquée définitivement pour tous les utilisateurs. Cette action ne peut pas être annulée.</p>
                  </div>
                )}
                <p className="text-sm text-red-700 font-medium text-center">
                  {isOsmZone ? 'Confirmer la désactivation ?' : 'Supprimer définitivement ?'}
                </p>
                <div className="flex gap-2">
                  <BivouacButton type="button" variant="destructive" onClick={handleDelete} disabled={isLoading} className="flex-1">
                    {isLoading ? <Loader2 size={15} className="animate-spin" /> : (isOsmZone ? 'Oui, désactiver' : 'Oui, supprimer')}
                  </BivouacButton>
                  <BivouacButton type="button" variant="outline" onClick={() => setConfirmDelete(false)} disabled={isLoading} className="flex-1">
                    Annuler
                  </BivouacButton>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <BivouacButton
                  type="submit"
                  variant="primary"
                  disabled={isLoading || (isExistingZone && !isDirty)}
                  className="flex-1"
                >
                  {isLoading && !confirmDelete
                    ? <><Loader2 size={15} className="animate-spin" /> Sauvegarde…</>
                    : isExistingZone ? 'Modifier la zone' : 'Créer la zone'}
                </BivouacButton>
                {isExistingZone && (
                  <BivouacButton
                    type="button"
                    variant="destructive"
                    onClick={() => setConfirmDelete(true)}
                    disabled={isLoading}
                    className="flex-1 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                  >
                    {isOsmZone ? 'Désactiver' : 'Supprimer'}
                  </BivouacButton>
                )}
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Modale de confirmation d'annulation */}
      {showConfirmClose && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl p-5 mx-4 max-w-sm w-full">
            <h4 className="text-base font-bold text-gray-800 mb-2">Annuler les modifications ?</h4>
            <p className="text-sm text-gray-600 mb-4">Les modifications non sauvegardées seront perdues.</p>
            <div className="flex gap-2">
              <BivouacButton
                type="button"
                variant="destructive"
                onClick={() => { setShowConfirmClose(false); onClose(); }}
                className="flex-1"
              >
                Oui, annuler
              </BivouacButton>
              <BivouacButton
                type="button"
                variant="outline"
                onClick={() => setShowConfirmClose(false)}
                className="flex-1"
              >
                Continuer l'édition
              </BivouacButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
