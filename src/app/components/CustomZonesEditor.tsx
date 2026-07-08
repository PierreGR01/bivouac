import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, Upload } from 'lucide-react';
import { CustomZoneForm } from './CustomZoneForm';
import { AdminZoneForm } from './AdminZoneForm';
import { CustomZone } from '../../utils/supabase/custom-zones-api';
import { AdminZone } from '../../utils/supabase/admin-zones-api';
import { ProtectedArea, protectedAreaToGeojson } from '../services/protected-areas';
import { fetchMassifsCatalog, MassifCatalogEntry } from '../../utils/massifs-catalog';
import { Panel } from './ui/bivouac-panel';
import { Select } from './ui/bivouac-input';

type EditorMode = 'regulated' | 'admin';

interface CustomZonesEditorProps {
  onClose: () => void;
  drawnGeometry?: GeoJSON.Feature | null;
  editingZone?: CustomZone | null;
  editingOsmZone?: ProtectedArea | null;
  onRegisterRequestClose?: (fn: () => void) => void;
  mode?: EditorMode;
  editingAdminZone?: AdminZone | null;
  onPreviewGeometryChange?: (geometry: GeoJSON.Feature | null) => void;
}

// osmZoneToGeojson est maintenant protectedAreaToGeojson dans protected-areas.ts

export function CustomZonesEditor({
  onClose,
  drawnGeometry,
  editingZone,
  editingOsmZone,
  onRegisterRequestClose,
  mode = 'regulated',
  editingAdminZone,
  onPreviewGeometryChange,
}: CustomZonesEditorProps) {
  const { isAdmin, isSuperAdmin } = useAuth();
  const [selectedGeometry, setSelectedGeometry] = useState<GeoJSON.Feature | null>(
    editingZone?.geometry
      ?? editingAdminZone?.geometry
      ?? (editingOsmZone ? protectedAreaToGeojson(editingOsmZone) : null)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [massifs, setMassifs] = useState<MassifCatalogEntry[]>([]);
  const [selectedMassifName, setSelectedMassifName] = useState<string | undefined>(undefined);
  const [selectedMassifSourceNote, setSelectedMassifSourceNote] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (mode === 'admin') {
      fetchMassifsCatalog().then(setMassifs).catch(() => setMassifs([]));
    }
  }, [mode]);

  // Aperçu carte : la zone sélectionnée (dessin déjà visible via Leaflet.Draw, mais pas
  // un massif prédéfini / import GeoJSON / territoire en cours d'édition).
  useEffect(() => {
    onPreviewGeometryChange?.(selectedGeometry);
    return () => onPreviewGeometryChange?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGeometry]);

  useEffect(() => {
    if (drawnGeometry) {
      setSelectedGeometry(drawnGeometry);
    }
  }, [drawnGeometry]);

  // When editingZone changes (e.g. clicking a different zone), update geometry
  useEffect(() => {
    if (editingZone) {
      setSelectedGeometry(editingZone.geometry);
    }
  }, [editingZone]);

  useEffect(() => {
    if (editingAdminZone) {
      setSelectedGeometry(editingAdminZone.geometry);
    }
  }, [editingAdminZone]);

  const isAllowed = mode === 'admin' ? isSuperAdmin : isAdmin;
  if (!isAllowed) return null;

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    try {
      const text = await file.text();
      const geojson = JSON.parse(text);
      let geometry = geojson;
      if (geojson.type === 'FeatureCollection' && geojson.features.length > 0) {
        geometry = geojson.features[0];
      }
      setSelectedGeometry(geometry);
    } catch (error) {
      console.error('Error parsing GeoJSON:', error);
      alert('Fichier GeoJSON invalide');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMassifSelect = (massifId: string) => {
    const massif = massifs.find((m) => m.id === massifId);
    if (!massif) return;
    setSelectedMassifName(massif.name);
    setSelectedMassifSourceNote(massif.sourceNote);
    setSelectedGeometry(massif.geometry);
  };

  if (selectedGeometry) {
    if (mode === 'admin') {
      return (
        <AdminZoneForm
          geometry={selectedGeometry}
          zone={editingAdminZone ?? undefined}
          prefill={selectedMassifName ? { name: selectedMassifName } : undefined}
          onClose={() => { setSelectedGeometry(null); setSelectedMassifName(undefined); setSelectedMassifSourceNote(undefined); onClose(); }}
          onSuccess={() => { setSelectedGeometry(null); setSelectedMassifName(undefined); setSelectedMassifSourceNote(undefined); onClose(); }}
          onRegisterRequestClose={onRegisterRequestClose}
        />
      );
    }
    const osmName = editingOsmZone?.name ?? editingOsmZone?.tags?.['name:fr'] ?? editingOsmZone?.tags?.name;
    return (
      <CustomZoneForm
        geometry={selectedGeometry}
        zone={editingZone ?? undefined}
        osmZoneId={editingOsmZone?.id}
        prefill={editingOsmZone ? { name: osmName } : undefined}
        onClose={() => { setSelectedGeometry(null); onClose(); }}
        onSuccess={() => { setSelectedGeometry(null); onClose(); }}
        onRegisterRequestClose={onRegisterRequestClose}
      />
    );
  }

  const content = (
    <>
      <p className="text-sm text-gray-600 mb-3">
        Dessinez un polygone sur la carte (vous pouvez déplacer et zoomer la carte pendant le tracé), importez un fichier GeoJSON{mode === 'admin' ? ', ou sélectionnez un massif prédéfini' : ''}.
      </p>

      {mode === 'admin' && massifs.length > 0 && (
        <div className="mb-3">
          <Select
            label="Massif prédéfini (contour OpenStreetMap)"
            value=""
            onChange={(e) => handleMassifSelect(e.target.value)}
            options={[
              { value: '', label: 'Choisir un massif…' },
              ...massifs.map((m) => ({ value: m.id, label: `${m.region} — ${m.name}` })),
            ]}
          />
          {selectedMassifSourceNote && (
            <p className="mt-1 text-xs text-gray-500">{selectedMassifSourceNote}</p>
          )}
        </div>
      )}

      <label
        className={`flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer ${
          isLoading ? 'opacity-50 pointer-events-none' : ''
        }`}
      >
        {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
        Importer un GeoJSON
        <input
          type="file"
          accept=".geojson,.json"
          onChange={handleFileUpload}
          className="hidden"
          disabled={isLoading}
        />
      </label>
    </>
  );

  return (
    <Panel onClose={onClose} title={mode === 'admin' ? 'Créer un territoire' : 'Créer une zone réglementée'}>
      {content}
    </Panel>
  );
}
