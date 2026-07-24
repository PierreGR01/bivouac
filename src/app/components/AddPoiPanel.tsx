import React, { useState, useRef, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { gps } from 'exifr/dist/mini.esm.mjs';
import { MapPin, Upload, Snowflake, SunSnow, AlertCircle, AlertTriangle, Camera, Image as ImageIcon, Tent, Locate, Loader2, X } from 'lucide-react';
import { Panel } from './ui/bivouac-panel';
import { BivouacButton, FilterChip } from './ui/bivouac-button';
import { AlertCard } from './ui/bivouac-card';
import { DifficultySelector, Input, Textarea, Toggle } from './ui/bivouac-input';
import { useIsMobile } from './ui/use-mobile';
import { PhotoCaptureModal } from './PhotoCaptureModal';
import { PoiLocation, SpotPhoto } from '../types';
import { getPhotoUrl, getPhotoCaption } from '../utils/photo';
import { uploadPhoto } from '../../utils/supabase/api';
import { CustomZone, getZoneRestrictionStatus, formatZoneConstraints } from '../../utils/supabase/custom-zones-api';
import { ProtectedArea, findAreasContainingPoint, getProtectedAreaInfo } from '../services/protected-areas';
import { computeAreaM2, MAX_POI_ZONE_AREA_M2 } from '../utils/poi-zone';

interface AddPoiPanelProps {
  onClose: () => void;
  onSubmit: (poi: NewPoi) => void;
  selectedPosition: { lat: number; lng: number } | null;
  onSetPosition: (position: { lat: number; lng: number } | null) => void;
  onStartReposition?: () => void;
  isRepositioning?: boolean;
  customZones?: CustomZone[];
  protectedAreas?: ProtectedArea[];
  mode?: 'create' | 'edit';
  initialPoi?: PoiLocation | null;
  zoneGeometry?: GeoJSON.Feature | null;
  onStartDrawZone?: () => void;
  onRemoveZone?: () => void;
  isDrawingZone?: boolean;
}

const NATIONAL_PARK_REGULATION = 'Zone de parc national - bivouac uniquement 19h à 9h';

function parseInitialRegulations(regulations?: string) {
  if (!regulations) return { hasRegulations: false, isNationalPark: false, regulationDetails: '' };
  const isNationalPark = regulations.includes(NATIONAL_PARK_REGULATION);
  const regulationDetails = isNationalPark
    ? regulations.replace(NATIONAL_PARK_REGULATION, '').replace(/^\.\s*/, '').trim()
    : regulations;
  return { hasRegulations: true, isNationalPark, regulationDetails };
}

function normalizeInitialPhotos(photos?: (string | SpotPhoto)[]): SpotPhoto[] {
  if (!photos) return [];
  return photos.map((photo) => {
    const caption = getPhotoCaption(photo);
    const thumbUrl = typeof photo === 'string' ? undefined : photo.thumbUrl;
    return {
      url: getPhotoUrl(photo),
      ...(thumbUrl ? { thumbUrl } : {}),
      ...(caption ? { caption } : {}),
    };
  });
}

// Miroir de la limite appliquée côté serveur (index.ts, POST/PUT /pois) — vérifiée aussi
// ici pour ne pas laisser l'utilisateur compresser/uploader une photo qui sera de toute
// façon rejetée à l'enregistrement.
const MAX_PHOTOS_PER_SPOT = 4;

// Target: keep uploaded photos around 2 Mo (compressed client-side before upload to
// Supabase Storage), so we retry at lower quality/size until we fit under this budget.
const TARGET_PHOTO_BYTES = 2 * 1024 * 1024;
const MAX_PHOTO_BYTES = 2.5 * 1024 * 1024;
const COMPRESSION_STEPS: Array<{ maxDimension: number; quality: number }> = [
  { maxDimension: 1600, quality: 0.82 },
  { maxDimension: 1600, quality: 0.65 },
  { maxDimension: 1200, quality: 0.7 },
  { maxDimension: 1200, quality: 0.55 },
  { maxDimension: 1000, quality: 0.6 },
  { maxDimension: 800, quality: 0.55 },
  { maxDimension: 600, quality: 0.5 },
];

function dataUrlBytes(dataUrl: string): number {
  return (dataUrl.length * 3) / 4;
}

// Vignette générée à l'upload pour l'affichage compact de la fiche spot (~64px) — 160px
// donne de la marge pour les écrans retina sans reproduire le poids de l'image complète.
const THUMBNAIL_MAX_DIMENSION = 160;
const THUMBNAIL_QUALITY = 0.6;

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossible de charger l'image"));
    img.src = dataUrl;
  });
}

function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return fetch(dataUrl).then((r) => r.blob());
}

function drawToDataUrl(img: HTMLImageElement, maxDimension: number, quality: number): string {
  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas non supporté');
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        let smallest = drawToDataUrl(img, COMPRESSION_STEPS[0].maxDimension, COMPRESSION_STEPS[0].quality);
        if (dataUrlBytes(smallest) <= TARGET_PHOTO_BYTES) {
          resolve(smallest);
          return;
        }
        for (const step of COMPRESSION_STEPS.slice(1)) {
          smallest = drawToDataUrl(img, step.maxDimension, step.quality);
          if (dataUrlBytes(smallest) <= TARGET_PHOTO_BYTES) {
            resolve(smallest);
            return;
          }
        }
        resolve(smallest);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Impossible de charger l'image"));
    };
    img.src = objectUrl;
  });
}

export interface NewPoi {
  title: string;
  description: string;
  photos: SpotPhoto[];
  season: 'hiver' | 'toute-annee';
  regulations: string;
  position: { lat: number; lng: number };
  capacity: '1' | '2-3' | '4-5' | '5+';
  difficulty: number;
  altitude?: number;
  zoneGeometry?: GeoJSON.Feature | null;
  isPublic: boolean;
}

export function AddPoiPanel({
  onClose,
  onSubmit,
  selectedPosition,
  onSetPosition,
  onStartReposition,
  isRepositioning = false,
  customZones = [],
  protectedAreas = [],
  mode = 'create',
  initialPoi = null,
  zoneGeometry = null,
  onStartDrawZone,
  onRemoveZone,
  isDrawingZone = false,
}: AddPoiPanelProps) {
  const isMobile = useIsMobile();
  const isEditMode = mode === 'edit';

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

  const initialRegulations = useMemo(() => parseInitialRegulations(initialPoi?.regulations), [initialPoi]);

  const [title, setTitle] = useState(initialPoi?.title ?? '');
  const [description, setDescription] = useState(initialPoi?.description ?? '');
  const [photos, setPhotos] = useState<SpotPhoto[]>(() => normalizeInitialPhotos(initialPoi?.photos));
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [season, setSeason] = useState<'hiver' | 'toute-annee'>(initialPoi?.season === 'hiver' ? 'hiver' : 'toute-annee');
  const [hasRegulations, setHasRegulations] = useState(initialRegulations.hasRegulations);
  const [regulationDetails, setRegulationDetails] = useState(initialRegulations.regulationDetails);
  const [isNationalPark, setIsNationalPark] = useState(initialRegulations.isNationalPark);
  const [capacity, setCapacity] = useState<'1' | '2-3' | '4-5' | '5+'>(initialPoi?.capacity ?? '2-3');
  const [difficulty, setDifficulty] = useState<number>(initialPoi?.difficulty ?? 2);
  const [wantsZone, setWantsZone] = useState(!!initialPoi?.zoneGeometry);
  const [isPublic, setIsPublic] = useState(initialPoi?.isPublic !== false);
  const [isGeolocating, setIsGeolocating] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<{ dataUrl: string; source: 'camera' | 'gallery' } | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const selectedPositionRef = useRef(selectedPosition);
  useEffect(() => {
    selectedPositionRef.current = selectedPosition;
  }, [selectedPosition]);

  const isBlocked = zoneStatus.blocked.length > 0 || osmZoneStatus.blocked.length > 0;
  const isFormValid = Boolean(selectedPosition && title.trim() && description.trim() && !isBlocked && !isDrawingZone);

  const handleToggleWantsZone = (checked: boolean) => {
    setWantsZone(checked);
    if (checked) {
      // Pas de zone existante à conserver : lance directement le tracé, pas de bouton
      // intermédiaire à cliquer en plus de la case à cocher.
      if (!zoneGeometry) onStartDrawZone?.();
    } else {
      onRemoveZone?.();
    }
  };

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
    if (photos.length >= MAX_PHOTOS_PER_SPOT) {
      toast.error(`Maximum ${MAX_PHOTOS_PER_SPOT} photos par spot`);
      return;
    }
    if (newPhotoUrl.trim()) {
      setPhotos([...photos, { url: newPhotoUrl.trim() }]);
      setNewPhotoUrl('');
    }
  };

  const handleFileSelect = (source: 'camera' | 'gallery') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.target;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file || !file.type.startsWith('image/')) return;

    if (photos.length >= MAX_PHOTOS_PER_SPOT) {
      toast.error(`Maximum ${MAX_PHOTOS_PER_SPOT} photos par spot`);
      return;
    }

    if (!selectedPositionRef.current) {
      gps(file)
        .then((position: { latitude: number; longitude: number } | undefined) => {
          if (position && !selectedPositionRef.current) {
            onSetPosition({ lat: position.latitude, lng: position.longitude });
            (window as any).__mapPanToAddMode?.(position.latitude, position.longitude);
            toast.success('Position du spot déterminée à partir de la photo');
          }
        })
        .catch(() => {});
    }

    compressImageFile(file)
      .then((dataUrl) => {
        if (dataUrlBytes(dataUrl) > MAX_PHOTO_BYTES) {
          alert('Photo trop volumineuse même après compression. Veuillez choisir une image plus petite.');
          return;
        }
        setPendingPhoto({ dataUrl, source });
      })
      .catch(() => {
        alert("Impossible de traiter cette image. Veuillez réessayer avec une autre photo.");
      });
  };

  const handleRetakePhoto = () => {
    if (pendingPhoto?.source === 'camera') cameraInputRef.current?.click();
    else galleryInputRef.current?.click();
  };

  const handleConfirmPhoto = async (finalImageUrl: string, caption: string) => {
    if (photos.length >= MAX_PHOTOS_PER_SPOT) {
      toast.error(`Maximum ${MAX_PHOTOS_PER_SPOT} photos par spot`);
      setPendingPhoto(null);
      return;
    }
    const trimmedCaption = caption.trim();
    setIsUploadingPhoto(true);
    try {
      const img = await loadImage(finalImageUrl);
      const thumbDataUrl = drawToDataUrl(img, THUMBNAIL_MAX_DIMENSION, THUMBNAIL_QUALITY);
      const [fullBlob, thumbBlob] = await Promise.all([
        dataUrlToBlob(finalImageUrl),
        dataUrlToBlob(thumbDataUrl),
      ]);
      const [uploadedUrl, uploadedThumbUrl] = await Promise.all([
        uploadPhoto(fullBlob),
        uploadPhoto(thumbBlob),
      ]);
      setPhotos((prev) => [...prev, {
        url: uploadedUrl,
        thumbUrl: uploadedThumbUrl,
        ...(trimmedCaption ? { caption: trimmedCaption } : {}),
      }]);
      setPendingPhoto(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d'envoyer la photo. Réessayez.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
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

    // En mode création, le panneau se ferme lui-même (côté parent) uniquement en cas de
    // succès de l'enregistrement — voir handleSubmitPoi/onSuccess dans App.tsx. Réinitialiser
    // les champs locaux ici serait soit invisible (succès : le panneau se démonte presque
    // aussitôt), soit destructeur (échec : le panneau resterait ouvert mais vidé, faisant
    // perdre à l'utilisateur ce qu'il venait de saisir alors que rien n'a été enregistré).
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      photos,
      season,
      regulations,
      position: selectedPosition,
      capacity,
      difficulty,
      zoneGeometry: wantsZone ? zoneGeometry : null,
      isPublic,
    });
  };

  return (
    <>
    <Panel onClose={onClose} title={isEditMode ? 'Modifier le spot' : 'Ajouter un spot'} mobileMaxHeight="50vh">
      <form onSubmit={handleSubmit}>
        {/* Position */}
        <div className="mb-3">
          {!selectedPosition || (isEditMode && isRepositioning) ? (
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
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-green-50 rounded-lg p-2.5 flex items-center gap-2 text-green-700">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-medium">
                  {selectedPosition.lat.toFixed(4)}°N, {selectedPosition.lng.toFixed(4)}°E
                </span>
              </div>
              {isEditMode && (
                <BivouacButton
                  type="button"
                  variant="outline"
                  onClick={onStartReposition}
                  className="flex-shrink-0 text-xs px-2.5 py-1.5"
                >
                  Repositionner
                </BivouacButton>
              )}
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

        {/* Zone associée (optionnelle) */}
        <div className="mb-3">
          <label className="flex items-center gap-2 cursor-pointer mb-2">
            <input
              type="checkbox"
              checked={wantsZone}
              onChange={(e) => handleToggleWantsZone(e.target.checked)}
              disabled={!selectedPosition}
              className="w-4 h-4 text-orange-600 rounded focus:ring-2 focus:ring-orange-500"
            />
            <span className="text-sm font-medium text-gray-800">
              Associer une zone au spot (max {MAX_POI_ZONE_AREA_M2} m²)
            </span>
          </label>

          {wantsZone && (
            zoneGeometry ? (
              <div className="flex items-center justify-between gap-2 bg-orange-50 border border-orange-200 rounded-lg p-2.5">
                <span className="text-sm text-orange-800 font-medium">
                  Zone de {Math.round(computeAreaM2(zoneGeometry))} m²
                </span>
                <div className="flex gap-2 flex-shrink-0">
                  <BivouacButton type="button" variant="outline" onClick={onStartDrawZone} className="text-xs px-2.5 py-1.5">
                    Redessiner
                  </BivouacButton>
                  <BivouacButton type="button" variant="outline" onClick={onRemoveZone} className="text-xs px-2.5 py-1.5 text-red-700 border-red-200 hover:bg-red-50">
                    Retirer
                  </BivouacButton>
                </div>
              </div>
            ) : (
              <div className="bg-orange-50 border-l-4 border-orange-400 p-2.5 rounded-r-lg text-orange-800 text-sm">
                {isDrawingZone
                  ? 'Dessinez le contour sur la carte…'
                  : 'Décochez puis recochez la case pour relancer le tracé.'}
              </div>
            )
          )}
        </div>

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
            <label className="block text-sm font-semibold mb-1.5 text-gray-700">
              Photos ({photos.length}/{MAX_PHOTOS_PER_SPOT})
            </label>
          )}

          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-2">
              {photos.map((photo, index) => (
                <div key={index} className="relative group">
                  <img
                    src={photo.url}
                    alt={photo.caption || `Photo ${index + 1}`}
                    className="w-full h-16 object-cover rounded-lg"
                  />
                  {photo.caption && (
                    <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] leading-tight px-1 py-0.5 truncate rounded-b-lg">
                      {photo.caption}
                    </div>
                  )}
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

          {photos.length >= MAX_PHOTOS_PER_SPOT ? (
            <p className="text-xs text-gray-500">
              Limite de {MAX_PHOTOS_PER_SPOT} photos atteinte — supprimez-en une pour en ajouter une autre.
            </p>
          ) : (
            <>
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
            </>
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

        {/* Visibilité */}
        <div className="mb-4 flex items-center justify-between gap-3 border border-gray-200 rounded-lg p-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800">Spot public</p>
            <p className="text-xs text-gray-500">
              {isPublic ? 'Visible par tous les utilisateurs' : 'Visible uniquement par vous et les administrateurs'}
            </p>
          </div>
          <Toggle enabled={isPublic} onChange={() => setIsPublic((v) => !v)} />
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
            {isEditMode
              ? (isMobile ? 'Enregistrer' : 'Enregistrer les modifications')
              : (isMobile ? 'Créer le spot' : 'Soumettre le point de bivouac')}
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
        isSubmitting={isUploadingPhoto}
      />
    )}
    </>
  );
}
