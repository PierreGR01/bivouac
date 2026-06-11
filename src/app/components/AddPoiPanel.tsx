import React, { useState, useRef } from 'react';
import { MapPin, Upload, Snowflake, Sun, AlertCircle, Camera, Mountain, Tent, Locate, Loader2, X } from 'lucide-react';
import { Panel } from './ui/bivouac-panel';
import { BivouacButton } from './ui/bivouac-button';
import { useIsMobile } from './ui/use-mobile';

interface AddPoiPanelProps {
  onClose: () => void;
  onSubmit: (poi: NewPoi) => void;
  selectedPosition: { lat: number; lng: number } | null;
  onSetPosition: (position: { lat: number; lng: number } | null) => void;
}

export interface NewPoi {
  title: string;
  description: string;
  photos: string[];
  season: 'hiver' | 'été';
  regulations: string;
  position: { lat: number; lng: number };
  capacity: '1' | '2-3' | '4-5' | '5+';
  difficulty: number;
  altitude?: number;
}

export function AddPoiPanel({ onClose, onSubmit, selectedPosition, onSetPosition }: AddPoiPanelProps) {
  const isMobile = useIsMobile();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [season, setSeason] = useState<'hiver' | 'été'>('été');
  const [hasRegulations, setHasRegulations] = useState(false);
  const [regulationDetails, setRegulationDetails] = useState('');
  const [isNationalPark, setIsNationalPark] = useState(false);
  const [capacity, setCapacity] = useState<'1' | '2-3' | '4-5' | '5+'>('2-3');
  const [difficulty, setDifficulty] = useState<number>(2);
  const [isGeolocating, setIsGeolocating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUseMyLocation = () => {
    if ('geolocation' in navigator) {
      setIsGeolocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          onSetPosition({ lat: latitude, lng: longitude });
          (window as any).__mapCenterTo?.(latitude, longitude);
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) setPhotoUrls([...photoUrls, dataUrl]);
      };
      reader.readAsDataURL(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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

        {/* Titre */}
        <div className="mb-3">
          {!isMobile && (
            <label className="block text-sm font-semibold mb-1.5 text-gray-700">
              Titre <span className="text-red-500">*</span>
            </label>
          )}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isMobile ? 'Titre du spot *' : 'Ex : Lac des Chéserys'}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
            required
          />
        </div>

        {/* Description */}
        <div className="mb-3">
          {!isMobile && (
            <label className="block text-sm font-semibold mb-1.5 text-gray-700">
              Description <span className="text-red-500">*</span>
            </label>
          )}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={isMobile ? 'Description *' : 'Décrivez le lieu, l\'accès, les particularités…'}
            rows={isMobile ? 2 : 3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none bg-white"
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

          {isMobile ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />
              <BivouacButton
                type="button"
                variant="outline"
                icon={<Camera className="w-4 h-4" />}
                onClick={() => fileInputRef.current?.click()}
                className="w-full text-sm"
              >
                Prendre une photo
              </BivouacButton>
            </>
          ) : (
            <div className="flex gap-2">
              <input
                type="url"
                value={newPhotoUrl}
                onChange={(e) => setNewPhotoUrl(e.target.value)}
                placeholder="URL de la photo"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
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
            <button
              type="button"
              onClick={() => setSeason('été')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium ${
                season === 'été'
                  ? 'border-amber-500 bg-amber-50 text-amber-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-amber-300'
              }`}
            >
              <Sun className="w-4 h-4" />
              Été
            </button>
            <button
              type="button"
              onClick={() => setSeason('hiver')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium ${
                season === 'hiver'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300'
              }`}
            >
              <Snowflake className="w-4 h-4" />
              Hiver
            </button>
          </div>
        </div>

        {/* Capacité */}
        <div className="mb-3">
          <label className="block text-sm font-semibold mb-1.5 text-gray-700">
            Capacité <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-4 gap-2">
            {(['1', '2-3', '4-5', '5+'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setCapacity(value)}
                className={`flex flex-col items-center justify-center py-2 rounded-lg border-2 transition-all ${
                  capacity === value
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-300'
                }`}
              >
                <Tent className="w-4 h-4 mb-1" />
                <span className="text-xs font-medium">{value}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Difficulté */}
        <div className="mb-3">
          <label className="block text-sm font-semibold mb-1.5 text-gray-700">
            Difficulté d'accès <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-1.5">
            {[0, 1, 2, 3, 4, 5].map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setDifficulty(level)}
                className={`flex-1 h-10 flex items-center justify-center rounded-lg border-2 transition-all ${
                  difficulty === level
                    ? level === 0
                      ? 'border-gray-500 bg-gray-100 text-gray-700'
                      : level <= 2
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : level === 3
                      ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                      : 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                }`}
              >
                <span className="text-sm font-bold">{level}</span>
              </button>
            ))}
          </div>
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
              <textarea
                value={regulationDetails}
                onChange={(e) => setRegulationDetails(e.target.value)}
                placeholder="Autres restrictions…"
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none bg-white"
              />
            </div>
          )}
        </div>

        {/* Soumettre */}
        <BivouacButton type="submit" variant="primary" className="w-full py-2.5 text-sm">
          {isMobile ? 'Créer le spot' : 'Soumettre le point de bivouac'}
        </BivouacButton>
      </form>
    </Panel>
  );
}
