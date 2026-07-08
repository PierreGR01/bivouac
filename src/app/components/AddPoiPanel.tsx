import React, { useState, useRef, useMemo } from 'react';
import { MapPin, Upload, Snowflake, SunSnow, AlertCircle, AlertTriangle, Camera, Image as ImageIcon, Mountain, Tent, Locate, Loader2, X } from 'lucide-react';
import { Panel } from './ui/bivouac-panel';
import { BivouacButton, FilterChip } from './ui/bivouac-button';
import { AlertCard } from './ui/bivouac-card';
import { DifficultySelector, Input, Textarea } from './ui/bivouac-input';
import { useIsMobile } from './ui/use-mobile';
import { PhotoCaptureModal } from './PhotoCaptureModal';
import { CustomZone, getZoneRestrictionStatus, formatZoneConstraints } from '../../utils/supabase/custom-zones-api';
import { ProtectedArea, findAreasContainingPoint, getProtectedAreaInfo } from '../services/protected-areas';

interface AddPoiPanelProps {
  onClose: () => void;
  onSubmit: (poi: NewPoi) => void;
  selectedPosition: { lat: number; lng: number } | null;
  onSetPosition: (position: { lat: number; lng: number } | null) => void;
  customZones?: CustomZone[];
  protectedAreas?: ProtectedArea[];
}

export interface NewPoi {
  title: string;
  description: string;
  photos: string[];
  season: 'hiver' | 'toute-annee';
  regulations: string;
  position: { lat: number; lng: number };
  capacity: '1' | '2-3' | '4-5' | '5+';
  difficulty: number;
  altitude?: number;
}

export function AddPoiPanel({ onClose, onSubmit, selectedPosition, onSetPosition, customZones = [], protectedAreas = [] }: AddPoiPanelProps) {
  const isMobile = useIsMobile();

  const zoneStatus = useMemo(() => {
    if (!selectedPosition) return { blocked: [], warnings: [] };
    return getZoneRestrictionStatus(selectedPosition, customZones);
  }, [selectedPosition, customZones]);

  const osmZoneStatus = useMemo(() => {
    if (!selectedPosition || protectedAreas.length === 0) return { blocked: [], warnings: [] };
    const areas = findAreasContainingPoint(selectedPosition, protectedAreas);
    const blocked: ProtectedArea[] = [];
    const warnings: ProtectedArea[] = [];
    areas.forEach(area => {
      const info = getProtectedAreaInfo(area);
      if (info.isCampingForbidden) blocked.push(area);
      else warnings.push(area);
    });
    return { blocked, warnings };
  }, [selectedPosition, protectedAreas]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [season, setSeason] = useState<'hiver' | 'toute-annee'>('toute-annee');
  const [hasRegulations, setHasRegulations] = useState(false);
  const [regulationDetails, setRegulationDetails] = useState('');
  const [isNationalPark, setIsNationalPark] = useState(false);
  const [capacity, setCapacity] = useState<'1' | '2-3' | '4-5' | '5+'>('2-3');
  const [difficulty, setDifficulty] = useState<number>(2);
  const [isGeolocating, setIsGeolocating] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<{ dataUrl: string; source: 'camera' | 'gallery' } | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const isBlocked = zoneStatus.blocked.length > 0 || osmZoneStatus.blocked.length > 0;
  const isFormValid = Boolean(selectedPosition && title.trim() && description.trim() && !isBlocked);

  const handleUseMyLocation = () => {
    if ('geolocation' in navigator) {
      setIsGeolocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          onSetPosition({ lat: latitude, lng: longitude });
          (window as any).__mapPanToAddMode?.(latitude, longitude);
          setIsGeolocating(false);
        },
        (error) => {
          console.error('Erreur de géolocalisation:', error);
          alert('Impossible d\'accéder à votre position. Vérifiez les permissions de localisation.');
          setIsGeolocating(false);
        }
      );
    } else {
      alert('La géolocalisation n\'est pas supportée par votre navigateur.');
    }
  };

  const handleAddPhoto = () => {
    if (newPhotoUrl.trim()) {
      setPhotoUrls([...photoUrls, newPhotoUrl.trim()]);
      setNewPhotoUrl('');
    }
  };

  const handleFileSelect = (source: 'camera' | 'gallery') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.target;
    const file = inputEl.files?.[0];
    if (file && file.type.startsWith('image/')) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Photo trop volumineuse (maximum 2 Mo). Veuillez choisir une image plus petite.');
        inputEl.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) setPendingPhoto({ dataUrl, source });
      };
      reader.readAsDataURL(file);
      inputEl.value = '';
    }
  };

  const handleRetakePhoto = () => {
    if (pendingPhoto?.source === 'camera') cameraInputRef.current?.click();
    else galleryInputRef.current?.click();
  };

  const handleConfirmPhoto = (finalImageUrl: string) => {
    setPhotoUrls((prev) => [...prev, finalImageUrl]);
    setPendingPhoto(null);
  };

  const handleRemovePhoto = (index: number) => {
    setPhotoUrls(photoUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPosition) {
      alert('Veuillez cliquer sur la carte pour définir la position du point de bivouac');
      return;
    }
    if (isBlocked) return;
    if (!title.trim() || !description.trim()) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    let regulations = '';
    if (hasRegulations) {
      if (isNationalPark) regulations = 'Zone de parc national - bivouac uniquement 19h à 9h';
      if (regulationDetails.trim()) {
        regulations = regulations
          ? `${regulations}. ${regulationDetails.trim()}`
          : regulationDetails.trim();
      }
    }

    onSubmit({
      title: title.trim(),
      description: description.trim(),
      photos: photoUrls,
      season,
      regulations,
      position: selectedPosition,
      capacity,
      difficulty,
    });

    setTitle('');
    setDescription('');
    setPhotoUrls([]);
    setNewPhotoUrl('');
    setSeason('été');
    setHasRegulations(false);
    setRegulationDetails('');
    setIsNationalPark(false);
    setCapacity('2-3');
    setDifficulty(2);
  };

  return (
    <>
    <Panel onClose={onClose} title="Ajouter un spot" mobileMaxHeight="50vh">
      <form onSubmit={handleSubmit}>
        {/* Position */}
        <div className="mb-3">
          {!selectedPosition ? (
            <div className="flex gap-2">
              <div className="flex-1 bg-emerald-50 border-l-4 border-emerald-400 p-2.5 rounded-r-lg flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <p className="text-emerald-800 text-sm">Cliquez sur la carte</p>
              </div>
              <BivouacButton
                type="button"
                variant="primary"
                icon={
                  isGeolocating
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Locate className="w-4 h-4" />
                }
                onClick={handleUseMyLocation}
                disabled={isGeolocating}
                className="flex-1 text-sm"
              >
                {isGeolocating ? 'Localisation…' : 'Ma position'}
              </BivouacButton>
            </div>
          ) : (
            <div className="bg-green-50 rounded-lg p-2.5 flex items-center gap-2 text-green-700">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">
                {selectedPosition.lat.toFixed(4)}°N, {selectedPosition.lng.toFixed(4)}°E
              </span>
            </div>
          )}
        </div>

        {/* Zone restriction feedback */}
        {isBlocked && (
          <AlertCard type="error" className="mb-3 border-red-500">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-900">Création impossible</p>
                {zoneStatus.blocked.map(z => (
                  <p key={z.id} className="text-sm text-red-800 mt-0.5">
                    {z.name} — bivouac interdit (sans restriction horaire ou saisonnière)
                  </p>
                ))}
              </div>
            </div>
          </AlertCard>
        )}

        {!isBlocked && zoneStatus.warnings.length > 0 && (
          <AlertCard type="orange" className="mb-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-orange-900">Zone réglementée</p>
                {zoneStatus.warnings.map(z => (
                  <p key={z.id} className="text-sm text-orange-800 mt-0.5">
                    {z.name} — interdit {formatZoneConstraints(z)}
                  </p>
                ))}
              </div>
            </div>
          </AlertCard>
        )}

        {osmZoneStatus.blocked.length > 0 && (
          <AlertCard type="error" className="mb-3 border-red-500">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-900">Création impossible</p>
                {osmZoneStatus.blocked.map(area => {
                  const info = getProtectedAreaInfo(area);
                  return (
                    <p key={area.id} className="text-sm text-red-800 mt-0.5">
                      {info.title} — bivouac/camping interdit
                    </p>
                  );
                })}
              </div>
            </div>
          </AlertCard>
        )}

        {!isBlocked && osmZoneStatus.warnings.length > 0 && (
          <AlertCard type="orange" className="mb-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-orange-900">Zone réglementée</p>
                {osmZoneStatus.warnings.map(area => {
                  const info = getProtectedAreaInfo(area);
                  return (
                    <p key={area.id} className="text-sm text-orange-800 mt-0.5">
                      {info.title}
                      {info.restrictions.length > 0 && ` — ${info.restrictions[0]}`}
                    </p>
                  );
                })}
              </div>
            </div>
          </AlertCard>
        )}

        {/* Titre */}
        <div className="mb-3">
          <Input
            label={isMobile ? undefined : 'Titre *'}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isMobile ? 'Titre du spot *' : 'Ex : Lac des Chéserys'}
            className="text-sm px-3 py-2"
            required
          />
        </div>

        {/* Description */}
        <div className="mb-3">
          <Textarea
            label={isMobile ? undefined : 'Description *'}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={isMobile ? 'Description *' : "Décrivez le lieu, l'accès, les particularités…"}
            rows={isMobile ? 2 : 3}
            className="text-sm px-3 py-2"
            required
          />
        </div>

        {/* Photos */}
        <div className="mb-3">
          {!isMobile && (
            <label className="block text-sm font-semibold mb-1.5 text-gray-700">Photos</label>
          )}

          {photoUrls.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-2">
              {photoUrls.map((url, index) => (
                <div key={index} className="relative group">
                  <img
                    src={url}
                    alt={`Photo ${index + 1}`}
                    className="w-full h-16 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(index)}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect('camera')}
            className="hidden"
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect('gallery')}
            className="hidden"
          />

          <div className="flex gap-2">
            {isMobile && (
              <BivouacButton
                type="button"
                variant="outline"
                icon={<Camera className="w-4 h-4" />}
                onClick={() => cameraInputRef.current?.click()}
                className="flex-1 text-sm"
              >
                Prendre une photo
              </BivouacButton>
            )}
            <BivouacButton
              type="button"
              variant="outline"
              icon={<ImageIcon className="w-4 h-4" />}
              onClick={() => galleryInputRef.current?.click()}
              className="flex-1 text-sm"
            >
              Choisir une image
            </BivouacButton>
          </div>

          {!isMobile && (
            <div className="flex gap-2 mt-2">
              <Input
                type="url"
                value={newPhotoUrl}
                onChange={(e) => setNewPhotoUrl(e.target.value)}
                placeholder="URL de la photo"
                className="text-sm px-3 py-2"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddPhoto();
                  }
                }}
              />
              <BivouacButton
                type="button"
                variant="outline"
                icon={<Upload className="w-4 h-4" />}
                onClick={handleAddPhoto}
                className="text-sm"
              >
                Ajouter
              </BivouacButton>
            </div>
          )}
        </div>

        {/* Saison */}
        <div className="mb-3">
          {!isMobile && (
            <label className="block text-sm font-semibold mb-1.5 text-gray-700">
              Saison propice <span className="text-red-500">*</span>
            </label>
          )}
          <div className="flex gap-2">
            <FilterChip
              type="button"
              active={season === 'toute-annee'}
              onClick={() => setSeason('toute-annee')}
              activeColor="border-amber-500 bg-amber-50 text-amber-700"
              showCheckmark={false}
              className="px-3 py-2"
            >
              <SunSnow className="w-4 h-4" />
              Toute saison
            </FilterChip>
            <FilterChip
              type="button"
              active={season === 'hiver'}
              onClick={() => setSeason('hiver')}
              activeColor="border-blue-500 bg-blue-50 text-blue-700"
              showCheckmark={false}
              className="px-3 py-2"
            >
              <Snowflake className="w-4 h-4" />
              Hiver
            </FilterChip>
          </div>
        </div>

        {/* Capacité */}
        <div className="mb-3">
          <label className="block text-sm font-semibold mb-1.5 text-gray-700">
            Capacité <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-4 gap-2">
            {(['1', '2-3', '4-5', '5+'] as const).map((value) => (
              <FilterChip
                key={value}
                type="button"
                active={capacity === value}
                onClick={() => setCapacity(value)}
                activeColor="border-emerald-500 bg-emerald-50 text-emerald-700"
                showCheckmark={false}
                className="flex-col py-2 px-1"
              >
                <Tent className="w-4 h-4 mb-1" />
                <span className="text-xs font-medium">{value}</span>
              </FilterChip>
            ))}
          </div>
        </div>

        {/* Difficulté */}
        <div className="mb-3">
          <label className="block text-sm font-semibold mb-1.5 text-gray-700">
            Difficulté d'accès <span className="text-red-500">*</span>
          </label>
          <DifficultySelector
            selectedLevels={[difficulty]}
            onToggle={(level) => setDifficulty(level)}
          />
          {!isMobile && (
            <p className="text-xs text-gray-400 mt-1">0 = très facile · 3 = moyen · 5 = difficile</p>
          )}
        </div>

        {/* Réglementation */}
        <div className="mb-4">
          <label className={`flex items-center cursor-pointer border border-gray-200 rounded-lg hover:border-orange-300 transition-colors bg-white gap-2.5 p-3`}>
            <input
              type="checkbox"
              checked={hasRegulations}
              onChange={(e) => setHasRegulations(e.target.checked)}
              className="w-4 h-4 text-orange-600 rounded focus:ring-2 focus:ring-orange-500"
            />
            <AlertCircle className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-medium text-gray-800">Réglementation spécifique</span>
          </label>

          {hasRegulations && (
            <div className="mt-2 ml-3 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer border border-gray-200 rounded-lg p-2.5 hover:border-orange-300 transition-colors bg-white">
                <input
                  type="checkbox"
                  checked={isNationalPark}
                  onChange={(e) => setIsNationalPark(e.target.checked)}
                  className="w-4 h-4 text-orange-600 rounded focus:ring-2 focus:ring-orange-500"
                />
                <span className="text-sm text-gray-700">Parc national — bivouac 19h à 9h</span>
              </label>
              <Textarea
                value={regulationDetails}
                onChange={(e) => setRegulationDetails(e.target.value)}
                placeholder="Autres restrictions…"
                rows={2}
                className="text-sm px-3 py-2 focus:ring-orange-500"
              />
            </div>
          )}
        </div>

        {/* Soumettre */}
        <div className="sticky bottom-0 -mx-6 px-6 bg-white border-t border-gray-100 pt-3 pb-3">
          <BivouacButton type="submit" variant="primary" className="w-full py-2.5 text-sm" disabled={!isFormValid}>
            {isMobile ? 'Créer le spot' : 'Soumettre le point de bivouac'}
          </BivouacButton>
        </div>
      </form>
    </Panel>

    {pendingPhoto && (
      <PhotoCaptureModal
        key={pendingPhoto.dataUrl}
        imageUrl={pendingPhoto.dataUrl}
        onConfirm={handleConfirmPhoto}
        onRetake={handleRetakePhoto}
        onCancel={() => setPendingPhoto(null)}
      />
    )}
    </>
  );
}
