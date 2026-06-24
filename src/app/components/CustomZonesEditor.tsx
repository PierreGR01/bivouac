import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { X, Loader2, Upload, Hexagon, Square, Check } from 'lucide-react';
import { CustomZoneForm } from './CustomZoneForm';
import { CustomZone } from '../../utils/supabase/custom-zones-api';
import { ProtectedArea, protectedAreaToGeojson } from '../services/protected-areas';

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
    <>
      {/* Mobile: bottom sheet */}
      <div className="md:hidden fixed inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl z-[1000]" style={{ animation: 'slideUp 0.3s ease-out' }}>
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>
        <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors z-10">
          <X className="w-5 h-5" />
        </button>
        <div className="px-6 pb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Créer une zone réglementée</h2>
          {content}
        </div>
      </div>

      {/* Desktop: left panel */}
      <div className="hidden md:block fixed top-[158px] left-6 w-[480px] bg-white shadow-2xl z-[500] rounded-b-xl" style={{ animation: 'fadeIn 0.3s ease-out' }}>
        <div className="flex items-center justify-between px-6 py-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">Créer une zone réglementée</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-6 h-6 text-gray-800" />
          </button>
        </div>
        <div className="px-6 py-6">
          {content}
        </div>
      </div>
    </>
  );
}
