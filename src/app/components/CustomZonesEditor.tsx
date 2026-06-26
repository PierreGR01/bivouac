import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, Upload, Hexagon, Square, Check } from 'lucide-react';
import { CustomZoneForm } from './CustomZoneForm';
import { CustomZone } from '../../utils/supabase/custom-zones-api';
import { ProtectedArea, protectedAreaToGeojson } from '../services/protected-areas';
import { Panel } from './ui/bivouac-panel';

type DrawTool = 'polygon' | 'rectangle';

interface CustomZonesEditorProps {
  onClose: () => void;
  onDrawingToolChange?: (tool: DrawTool) => void;
  drawnGeometry?: GeoJSON.Feature | null;
  editingZone?: CustomZone | null;
  editingOsmZone?: ProtectedArea | null;
  onRegisterRequestClose?: (fn: () => void) => void;
}

// osmZoneToGeojson est maintenant protectedAreaToGeojson dans protected-areas.ts

export function CustomZonesEditor({ onClose, onDrawingToolChange, drawnGeometry, editingZone, editingOsmZone, onRegisterRequestClose }: CustomZonesEditorProps) {
  const { isAdmin } = useAuth();
  const [activeTool, setActiveTool] = useState<DrawTool>('polygon');
  const [selectedGeometry, setSelectedGeometry] = useState<GeoJSON.Feature | null>(
    editingZone?.geometry ?? (editingOsmZone ? protectedAreaToGeojson(editingOsmZone) : null)
  );
  const [isLoading, setIsLoading] = useState(false);

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

  if (!isAdmin) return null;

  const handleToolChange = (tool: DrawTool) => {
    setActiveTool(tool);
    onDrawingToolChange?.(tool);
  };

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

  if (selectedGeometry) {
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

  const tools: { tool: DrawTool; label: string; Icon: React.ElementType }[] = [
    { tool: 'polygon', label: 'Polygone', Icon: Hexagon },
    { tool: 'rectangle', label: 'Rectangle', Icon: Square },
  ];

  const content = (
    <>
      <div className="flex gap-2 mb-3">
        {tools.map(({ tool, label, Icon }) => {
          const selected = activeTool === tool;
          return (
            <button
              key={tool}
              onClick={() => handleToolChange(tool)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                selected
                  ? 'bg-emerald-600 border-2 border-emerald-600 text-white'
                  : 'bg-gray-50 border border-gray-300 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {selected && <Check size={13} strokeWidth={2.5} />}
              <Icon size={15} />
              {label}
            </button>
          );
        })}
      </div>

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
    <Panel onClose={onClose} title="Créer une zone réglementée">
      {content}
    </Panel>
  );
}
