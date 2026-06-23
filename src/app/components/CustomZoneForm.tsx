import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { createCustomZone, updateCustomZone, deleteCustomZone, CustomZone } from '../../utils/supabase/custom-zones-api';
import { hideOsmZone } from '../../utils/supabase/hidden-osm-zones-api';
import { ProtectedArea, fetchOsmZoneById, fetchAlpesProtectedAreas, protectedAreaToGeojson } from '../services/protected-areas';
import { BivouacButton } from './ui/bivouac-button';

interface CustomZoneFormProps {
  geometry: GeoJSON.Feature;
  onClose: () => void;
  onSuccess: () => void;
  zone?: CustomZone;
  osmZoneId?: string;
  prefill?: { name?: string };
}

const RESTRICTION_OPTIONS = [
  { value: 'camping_forbidden', label: 'Camping interdit' },
  { value: 'bivouac_forbidden', label: 'Bivouac interdit' },
  { value: 'fire_forbidden', label: 'Feu interdit' },
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

export function CustomZoneForm({ geometry, onClose, onSuccess, zone, osmZoneId, prefill }: CustomZoneFormProps) {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = !!zone;
  const isOsmZone = !!osmZoneId;

  const [name, setName] = useState(zone?.name ?? prefill?.name ?? '');
  const [description, setDescription] = useState(zone?.description ?? '');
  const [restrictionTypes, setRestrictionTypes] = useState<string[]>(
    zone?.restriction_types ?? ['camping_forbidden']
  );
  const [sourceUrl, setSourceUrl] = useState(zone?.source_url ?? '');
  const [osmSourceId, setOsmSourceId] = useState(zone?.osm_source_id ?? osmZoneId ?? '');

  const [timeRangeEnabled, setTimeRangeEnabled] = useState(!!(zone?.time_range_start));
  const [timeRangeStart, setTimeRangeStart] = useState(zone?.time_range_start ?? '09:00');
  const [timeRangeEnd, setTimeRangeEnd] = useState(zone?.time_range_end ?? '19:00');

  const [periodEnabled, setPeriodEnabled] = useState(!!(zone?.period_start));
  const [periodStart, setPeriodStart] = useState(zone?.period_start ?? '');
  const [periodEnd, setPeriodEnd] = useState(zone?.period_end ?? '');

  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [osmDetecting, setOsmDetecting] = useState(false);
  const [osmCandidates, setOsmCandidates] = useState<ProtectedArea[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Chargement des zones OSM candidates dans le secteur à l'ouverture du formulaire d'édition
  useEffect(() => {
    if (!isEditing) return;

    const geom = geometry.geometry;
    if (!geom) return;

    const ring = geom.type === 'Polygon'
      ? (geom as GeoJSON.Polygon).coordinates[0]
      : geom.type === 'MultiPolygon'
        ? (geom as GeoJSON.MultiPolygon).coordinates[0][0]
        : null;
    if (!ring || ring.length === 0) return;

    const lng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
    const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;

    setOsmDetecting(true);
    fetchAlpesProtectedAreas()
      .then(areas => {
        // Filtrer par proximité au centroïde (±0.5°)
        const nearby = areas.filter(a => {
          const geom = a.geometry;
          if (!geom.length) return false;
          const aLng = geom.reduce((s, p) => s + p.lng, 0) / geom.length;
          const aLat = geom.reduce((s, p) => s + p.lat, 0) / geom.length;
          return Math.abs(aLat - lat) < 0.5 && Math.abs(aLng - lng) < 0.5;
        });
        const candidates = nearby.filter(a => a.name);
        setOsmCandidates(candidates);
        if (!osmSourceId && candidates.length === 1) {
          setOsmSourceId(candidates[0].id);
        }
      })
      .finally(() => setOsmDetecting(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        // Si zone OSM : masquer l'original après création de la copie custom
        if (osmZoneId) {
          await hideOsmZone(osmZoneId);
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
        await hideOsmZone(osmZoneId);
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
    if (!osmSourceId.trim() || !zone) return;
    setIsResetting(true);
    setError(null);
    try {
      // Chercher d'abord dans les candidates déjà chargées (évite un appel réseau)
      const cached = osmCandidates.find(c => c.id === osmSourceId.trim());
      const osmZone = cached ?? await fetchOsmZoneById(osmSourceId.trim());
      if (!osmZone) throw new Error('Zone OSM introuvable (vérifier l\'ID)');
      const newGeometry = protectedAreaToGeojson(osmZone);
      await updateCustomZone(zone.id, { geometry: newGeometry, osm_source_id: osmSourceId.trim() });
      await queryClient.invalidateQueries({ queryKey: ['customZones'] });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la réinitialisation');
    } finally {
      setIsResetting(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';
  const smallInputClass = 'w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';

  return (
    <div
      className="fixed bottom-4 right-4 w-[22rem] bg-white rounded-lg shadow-2xl border border-gray-200 p-4 z-[9999] max-h-[90vh] overflow-y-auto"
      style={{ position: 'fixed', bottom: '16px', right: '16px', zIndex: 9999 }}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-4 sticky top-0 bg-white pb-2 border-b border-gray-100">
        <h3 className="text-lg font-bold text-gray-800">
          {isEditing ? 'Modifier la zone' : 'Créer une zone réglementée'}
        </h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
          <X size={18} className="text-gray-500" />
        </button>
      </div>

      {/* Erreur — en haut pour toujours être visible */}
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

        {/* Types de restrictions (cumulatifs) */}
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

        {/* Actions principales */}
        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <BivouacButton type="submit" variant="primary" disabled={isLoading} className="flex-1">
            {isLoading && !confirmDelete
              ? <><Loader2 size={15} className="animate-spin" /> Sauvegarde…</>
              : isEditing ? 'Modifier la zone' : 'Créer la zone'}
          </BivouacButton>
          <BivouacButton type="button" variant="outline" onClick={onClose} disabled={isLoading} className="flex-1">
            Annuler
          </BivouacButton>
        </div>

        {/* Mettre à jour depuis OSM — admin uniquement, zone existante */}
        {isEditing && (
          <div className="pt-2 border-t border-gray-100 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mettre à jour depuis OSM</p>
            {osmDetecting ? (
              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" /> Recherche des zones OSM dans le secteur…
              </p>
            ) : null}
            <div className="flex gap-2">
              {osmCandidates.length > 0 ? (
                <select
                  value={osmSourceId}
                  onChange={e => setOsmSourceId(e.target.value)}
                  className={`${inputClass} text-xs`}
                  disabled={isLoading || isResetting || osmDetecting}
                >
                  <option value="">— Choisir une zone OSM —</option>
                  {osmCandidates.map(c => (
                    <option key={c.id} value={c.id}>{c.name!}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={osmSourceId}
                  onChange={e => setOsmSourceId(e.target.value)}
                  placeholder="osm-relation-1024498"
                  className={`${inputClass} text-xs font-mono`}
                  disabled={isLoading || isResetting || osmDetecting}
                />
              )}
              <BivouacButton
                type="button"
                variant="outline"
                onClick={handleResetFromOsm}
                disabled={isLoading || isResetting || osmDetecting || !osmSourceId.trim()}
                className="shrink-0 text-blue-700 border-blue-200 hover:bg-blue-50"
                title="Recharger le tracé depuis OpenStreetMap"
              >
                {isResetting ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              </BivouacButton>
            </div>
            {!osmDetecting && osmCandidates.length === 0 && (
              <p className="text-xs text-gray-400">Aucune zone OSM trouvée dans le secteur. Saisir manuellement : <span className="font-mono">osm-relation-XXXXXXX</span></p>
            )}
          </div>
        )}

        {/* Suppression / Désactivation */}
        {(isEditing || isOsmZone) && (
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
              <BivouacButton
                type="button"
                variant="destructive"
                onClick={() => setConfirmDelete(true)}
                disabled={isLoading}
                className="w-full bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
              >
                {isOsmZone ? 'Désactiver cette zone' : 'Supprimer cette zone'}
              </BivouacButton>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
