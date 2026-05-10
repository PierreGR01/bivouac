import React, { useState } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { createCustomZone } from '../../utils/supabase/custom-zones-api';

interface CustomZoneFormProps {
  geometry: GeoJSON.Feature;
  onClose: () => void;
  onSuccess: () => void;
}

export function CustomZoneForm({ geometry, onClose, onSuccess }: CustomZoneFormProps) {
  const { currentUser } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [restrictionType, setRestrictionType] = useState<'camping_forbidden' | 'bivouac_forbidden' | 'fire_forbidden' | 'other'>('camping_forbidden');
  const [seasons, setSeasons] = useState<string[]>(['all_year']);
  const [sourceUrl, setSourceUrl] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [protectionLevel, setProtectionLevel] = useState<'strict' | 'moderate' | 'low'>('moderate');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSeasonToggle = (season: string) => {
    setSeasons(prev =>
      prev.includes(season)
        ? prev.filter(s => s !== season)
        : [...prev, season]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Le nom de la zone est obligatoire');
      return;
    }

    if (seasons.length === 0) {
      setError('Sélectionnez au moins une saison');
      return;
    }

    setIsLoading(true);
    try {
      await createCustomZone({
        name: name.trim(),
        description: description.trim(),
        geometry,
        restriction_type: restrictionType,
        seasons,
        source_url: sourceUrl.trim() || undefined,
        valid_from: validFrom || undefined,
        valid_until: validUntil || undefined,
        protection_level: protectionLevel,
      });

      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la création de la zone';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50 max-h-[90vh] overflow-y-auto" style={{ position: 'fixed', bottom: '16px', right: '16px', zIndex: 9999, width: '384px' }}>
      <div className="flex justify-between items-center mb-4 sticky top-0 bg-white pb-2 border-b">
        <h3 className="text-lg font-semibold">Créer une zone réglementée</h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
        >
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nom de la zone *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Parc du Mont-Blanc"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Contexte et détails de la restriction..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
        </div>

        {/* Restriction Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type de restriction *
          </label>
          <select
            value={restrictionType}
            onChange={(e) => setRestrictionType(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          >
            <option value="camping_forbidden">Camping interdit</option>
            <option value="bivouac_forbidden">Bivouac interdit</option>
            <option value="fire_forbidden">Feu interdit</option>
            <option value="other">Autre</option>
          </select>
        </div>

        {/* Seasons */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Saisons applicables *
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={seasons.includes('all_year')}
                onChange={() => handleSeasonToggle('all_year')}
                disabled={isLoading}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Toute l'année</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={seasons.includes('summer')}
                onChange={() => handleSeasonToggle('summer')}
                disabled={isLoading}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Été</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={seasons.includes('winter')}
                onChange={() => handleSeasonToggle('winter')}
                disabled={isLoading}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Hiver</span>
            </label>
          </div>
        </div>

        {/* Protection Level */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Niveau de protection *
          </label>
          <select
            value={protectionLevel}
            onChange={(e) => setProtectionLevel(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          >
            <option value="strict">Strict</option>
            <option value="moderate">Modéré</option>
            <option value="low">Bas</option>
          </select>
        </div>

        {/* Source URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Source officielle (URL)
          </label>
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
        </div>

        {/* Validity Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Valide à partir de
            </label>
            <input
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Valide jusqu'au
            </label>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Création...
              </>
            ) : (
              'Créer la zone'
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-md hover:bg-gray-300 disabled:opacity-50 font-medium transition-colors"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}
