import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { createAdminZone, updateAdminZone, deleteAdminZone, AdminZone } from '../../utils/supabase/admin-zones-api';
import { BivouacButton } from './ui/bivouac-button';
import { Input, Textarea } from './ui/bivouac-input';

interface AdminZoneFormProps {
  geometry: GeoJSON.Feature;
  onClose: () => void;
  onSuccess: () => void;
  zone?: AdminZone;
  prefill?: { name?: string };
  onRegisterRequestClose?: (fn: () => void) => void;
}

export function AdminZoneForm({ geometry, onClose, onSuccess, zone, prefill, onRegisterRequestClose }: AdminZoneFormProps) {
  const isEditing = !!zone;

  const initial = useMemo(() => ({
    name: zone?.name ?? prefill?.name ?? '',
    description: zone?.description ?? '',
    sourceUrl: zone?.source_url ?? '',
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [sourceUrl, setSourceUrl] = useState(initial.sourceUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  const isDirty = isEditing && (
    name !== initial.name
    || description !== initial.description
    || sourceUrl !== initial.sourceUrl
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Le nom du territoire est obligatoire');
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        geometry,
        source_url: sourceUrl.trim() || undefined,
      };

      if (isEditing && zone) {
        await updateAdminZone(zone.id, payload);
      } else {
        await createAdminZone(payload);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!zone) return;
    setIsLoading(true);
    try {
      await deleteAdminZone(zone.id);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
      setIsLoading(false);
    }
  };

  return (
    <>
      <div
        className="fixed bottom-4 right-4 w-[22rem] bg-white rounded-lg shadow-2xl border border-gray-200 p-4 z-[9999] max-h-[90vh] overflow-y-auto"
        style={{ position: 'fixed', bottom: '16px', right: '16px', zIndex: 9999 }}
      >
        <div className="flex justify-between items-center mb-4 sticky top-0 bg-white pb-2 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800">
            {isEditing ? 'Modifier le territoire' : 'Créer un territoire'}
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
          <Input
            label="Nom du territoire *"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Parc naturel de Chartreuse"
            className="text-sm px-3 py-2"
            disabled={isLoading}
          />

          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Contexte du territoire..."
            rows={2}
            className="text-sm px-3 py-2"
            disabled={isLoading}
          />

          <Input
            label="Source officielle (URL)"
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://..."
            className="text-sm px-3 py-2"
            disabled={isLoading}
          />

          <div className="pt-2 border-t border-gray-100">
            {confirmDelete ? (
              <div className="space-y-2">
                <p className="text-sm text-red-700 font-medium text-center">
                  Supprimer définitivement ce territoire ?
                </p>
                <div className="flex gap-2">
                  <BivouacButton type="button" variant="destructive" onClick={handleDelete} disabled={isLoading} className="flex-1">
                    {isLoading ? <Loader2 size={15} className="animate-spin" /> : 'Oui, supprimer'}
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
                  disabled={isLoading || (isEditing && !isDirty)}
                  className="flex-1"
                >
                  {isLoading
                    ? <><Loader2 size={15} className="animate-spin" /> Sauvegarde…</>
                    : isEditing ? 'Modifier le territoire' : 'Créer le territoire'}
                </BivouacButton>
                {isEditing && (
                  <BivouacButton
                    type="button"
                    variant="destructive"
                    onClick={() => setConfirmDelete(true)}
                    disabled={isLoading}
                    className="flex-1 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                  >
                    Supprimer
                  </BivouacButton>
                )}
              </div>
            )}
          </div>
        </form>
      </div>

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
