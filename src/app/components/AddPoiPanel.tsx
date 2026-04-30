import React, { useState, useRef } from 'react';
import { X, MapPin, Upload, Snowflake, Sun, AlertCircle, Image as ImageIcon, Camera, Mountain, Tent, Gauge, Locate, Loader2 } from 'lucide-react';

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
  const [isLoadingAltitude, setIsLoadingAltitude] = useState(false);
  const [isGeolocating, setIsGeolocating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUseMyLocation = () => {
    if ('geolocation' in navigator) {
      setIsGeolocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          onSetPosition({ lat: latitude, lng: longitude });
          // Recentrer la carte sur la position
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
        if (dataUrl) {
          setPhotoUrls([...photoUrls, dataUrl]);
        }
      };
      reader.readAsDataURL(file);
      // Reset input pour permettre de sélectionner la même image à nouveau
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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

    // Construire la réglementation
    let regulations = '';
    if (hasRegulations) {
      if (isNationalPark) {
        regulations = 'Zone de parc national - bivouac uniquement 19h à 9h';
      }
      if (regulationDetails.trim()) {
        regulations = regulations 
          ? `${regulations}. ${regulationDetails.trim()}`
          : regulationDetails.trim();
      }
    }

    const newPoi: NewPoi = {
      title: title.trim(),
      description: description.trim(),
      photos: photoUrls,
      season,
      regulations,
      position: selectedPosition,
      capacity,
      difficulty,
    };

    onSubmit(newPoi);
    
    // Reset form
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
      {/* Mobile: panneau du bas */}
      <div 
        className="md:hidden fixed inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl z-[1000] max-w-full overflow-hidden"
        style={{
          maxHeight: '50vh',
          animation: 'slideUp 0.3s ease-out'
        }}
      >
        <style>{`
          @keyframes slideUp {
            from {
              transform: translateY(100%);
            }
            to {
              transform: translateY(0);
            }
          }
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
        `}</style>
        
        {/* Poignée de glissement */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Bouton fermer */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Contenu scrollable */}
        <div className="overflow-y-auto px-5 pb-5" style={{ maxHeight: 'calc(50vh - 60px)' }}>
          <FormContent 
            title={title}
            setTitle={setTitle}
            description={description}
            setDescription={setDescription}
            photoUrls={photoUrls}
            newPhotoUrl={newPhotoUrl}
            setNewPhotoUrl={setNewPhotoUrl}
            handleAddPhoto={handleAddPhoto}
            handleFileSelect={handleFileSelect}
            fileInputRef={fileInputRef}
            handleRemovePhoto={handleRemovePhoto}
            season={season}
            setSeason={setSeason}
            hasRegulations={hasRegulations}
            setHasRegulations={setHasRegulations}
            regulationDetails={regulationDetails}
            setRegulationDetails={setRegulationDetails}
            isNationalPark={isNationalPark}
            setIsNationalPark={setIsNationalPark}
            selectedPosition={selectedPosition}
            handleSubmit={handleSubmit}
            onClose={onClose}
            isMobile={true}
            capacity={capacity}
            setCapacity={setCapacity}
            difficulty={difficulty}
            setDifficulty={setDifficulty}
            isLoadingAltitude={isLoadingAltitude}
            setIsLoadingAltitude={setIsLoadingAltitude}
            handleUseMyLocation={handleUseMyLocation}
            isGeolocating={isGeolocating}
          />
        </div>
      </div>

      {/* Desktop: panneau latéral gauche */}
      <div 
        className="hidden md:block fixed top-[158px] left-6 w-[480px] bg-white shadow-2xl z-[500] rounded-b-xl"
        style={{
          animation: 'fadeIn 0.3s ease-out',
          maxHeight: 'calc(100vh - 10.5rem)'
        }}
      >
        {/* Contenu scrollable */}
        <div className="overflow-y-auto px-6 py-6" style={{ maxHeight: 'calc(100vh - 10.5rem)' }}>
          <FormContent 
            title={title}
            setTitle={setTitle}
            description={description}
            setDescription={setDescription}
            photoUrls={photoUrls}
            newPhotoUrl={newPhotoUrl}
            setNewPhotoUrl={setNewPhotoUrl}
            handleAddPhoto={handleAddPhoto}
            handleFileSelect={handleFileSelect}
            fileInputRef={fileInputRef}
            handleRemovePhoto={handleRemovePhoto}
            season={season}
            setSeason={setSeason}
            hasRegulations={hasRegulations}
            setHasRegulations={setHasRegulations}
            regulationDetails={regulationDetails}
            setRegulationDetails={setRegulationDetails}
            isNationalPark={isNationalPark}
            setIsNationalPark={setIsNationalPark}
            selectedPosition={selectedPosition}
            handleSubmit={handleSubmit}
            onClose={onClose}
            isMobile={false}
            capacity={capacity}
            setCapacity={setCapacity}
            difficulty={difficulty}
            setDifficulty={setDifficulty}
            isLoadingAltitude={isLoadingAltitude}
            setIsLoadingAltitude={setIsLoadingAltitude}
            handleUseMyLocation={handleUseMyLocation}
            isGeolocating={isGeolocating}
          />
        </div>
      </div>
    </>
  );
}

// Composant pour le contenu du formulaire
function FormContent({
  title,
  setTitle,
  description,
  setDescription,
  photoUrls,
  newPhotoUrl,
  setNewPhotoUrl,
  handleAddPhoto,
  handleFileSelect,
  fileInputRef,
  handleRemovePhoto,
  season,
  setSeason,
  hasRegulations,
  setHasRegulations,
  regulationDetails,
  setRegulationDetails,
  isNationalPark,
  setIsNationalPark,
  selectedPosition,
  handleSubmit,
  onClose,
  isMobile = false,
  capacity,
  setCapacity,
  difficulty,
  setDifficulty,
  isLoadingAltitude,
  setIsLoadingAltitude,
  handleUseMyLocation,
  isGeolocating,
}: {
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  photoUrls: string[];
  newPhotoUrl: string;
  setNewPhotoUrl: (v: string) => void;
  handleAddPhoto: () => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleRemovePhoto: (index: number) => void;
  season: 'hiver' | 'été';
  setSeason: (v: 'hiver' | 'été') => void;
  hasRegulations: boolean;
  setHasRegulations: (v: boolean) => void;
  regulationDetails: string;
  setRegulationDetails: (v: string) => void;
  isNationalPark: boolean;
  setIsNationalPark: (v: boolean) => void;
  selectedPosition: { lat: number; lng: number } | null;
  handleSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  isMobile?: boolean;
  capacity: '1' | '2-3' | '4-5' | '5+';
  setCapacity: (v: '1' | '2-3' | '4-5' | '5+') => void;
  difficulty: number;
  setDifficulty: (v: number) => void;
  isLoadingAltitude: boolean;
  setIsLoadingAltitude: (v: boolean) => void;
  handleUseMyLocation: () => void;
  isGeolocating: boolean;
}) {
  return (
    <form onSubmit={handleSubmit}>
      {/* En-tête avec titre et bouton fermer (desktop uniquement) */}
      {!isMobile && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 drop-shadow-sm">Ajouter un point de bivouac</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-800" />
          </button>
        </div>
      )}
      
      {/* Titre mobile simplifié */}
      {isMobile && (
        <h2 className="text-lg font-bold text-gray-800 mb-3">Nouveau spot</h2>
      )}

      {/* Instructions OU Position sélectionnée */}
      {!selectedPosition ? (
        <div className={`mb-3`}>
          <div className={`flex gap-2`}>
            {/* Message d'instruction */}
            <div className={`flex-1 bg-emerald-50 border-l-4 border-emerald-400 rounded-r-lg ${isMobile ? 'p-2' : 'p-3'}`}>
              <div className="flex items-start gap-2">
                <MapPin className={`text-emerald-600 flex-shrink-0 mt-0.5 ${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
                <p className={`text-emerald-800 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                  Cliquez sur la carte
                </p>
              </div>
            </div>
            
            {/* Bouton pour utiliser ma position */}
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={isGeolocating}
              className={`flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg transition-colors flex items-center justify-center gap-2 ${
                isMobile ? 'py-2 text-xs' : 'py-2.5 text-sm'
              }`}
            >
              {isGeolocating ? (
                <>
                  <Loader2 className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} animate-spin`} />
                  <span className="whitespace-nowrap">{isMobile ? 'Localisation...' : 'Localisation...'}</span>
                </>
              ) : (
                <>
                  <Locate className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
                  <span className={`font-medium ${isMobile ? '' : ''}`}>Utilisez votre position</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className={`bg-green-50 rounded-lg mb-3 ${isMobile ? 'p-2' : 'p-3'}`}>
          <div className="flex items-center gap-2 text-green-700">
            <MapPin className={`${isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
            <span className={`font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>
              {selectedPosition.lat.toFixed(4)}°N, {selectedPosition.lng.toFixed(4)}°E
            </span>
          </div>
        </div>
      )}

      {/* Titre */}
      <div className={isMobile ? 'mb-3' : 'mb-4'}>
        {!isMobile && (
          <label className="block text-sm font-semibold mb-2 text-gray-800">
            Titre <span className="text-red-500">*</span>
          </label>
        )}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isMobile ? "Titre du spot *" : "Ex: Lac des Chéserys"}
          className={`w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white/50 ${
            isMobile ? 'px-3 py-2 text-sm' : 'px-4 py-2'
          }`}
          required
        />
      </div>

      {/* Description */}
      <div className={isMobile ? 'mb-3' : 'mb-4'}>
        {!isMobile && (
          <label className="block text-sm font-semibold mb-2 text-gray-800">
            Description <span className="text-red-500">*</span>
          </label>
        )}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={isMobile ? "Description *" : "Décrivez le lieu, l'accès, les particularités..."}
          rows={isMobile ? 2 : 3}
          className={`w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none bg-white/50 ${
            isMobile ? 'px-3 py-2 text-sm' : 'px-4 py-2'
          }`}
          required
        />
      </div>

      {/* Photos */}
      <div className={isMobile ? 'mb-3' : 'mb-4'}>
        {!isMobile && (
          <label className="block text-sm font-semibold mb-2 text-gray-800">
            Photos
          </label>
        )}
        
        {/* Liste des photos */}
        {photoUrls.length > 0 && (
          <div className={`grid grid-cols-2 gap-2 ${isMobile ? 'mb-2' : 'mb-3'}`}>
            {photoUrls.map((url, index) => (
              <div key={index} className="relative group">
                <img 
                  src={url} 
                  alt={`Photo ${index + 1}`}
                  className={`w-full object-cover rounded-lg ${isMobile ? 'h-16' : 'h-20'}`}
                />
                <button
                  type="button"
                  onClick={() => handleRemovePhoto(index)}
                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'}`} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Ajout de photo */}
        {isMobile ? (
          // Mobile : Bouton pour prendre une photo
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 py-2.5"
              title="Prendre une photo"
            >
              <Camera className="w-5 h-5" />
              <span className="text-sm font-medium">Prendre une photo</span>
            </button>
          </>
        ) : (
          // Desktop : Champ URL
          <>
            <div className="flex gap-2">
              <input
                type="url"
                value={newPhotoUrl}
                onChange={(e) => setNewPhotoUrl(e.target.value)}
                placeholder="URL de la photo"
                className="flex-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white/50 px-4 py-2"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddPhoto();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddPhoto}
                className="bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center px-4 py-2 gap-2"
                title="Ajouter une photo"
              >
                <Upload className="w-4 h-4" />
                <span>Ajouter</span>
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-1">Ajoutez des photos (URL) - optionnel</p>
          </>
        )}
      </div>

      {/* Saison */}
      <div className={isMobile ? 'mb-3' : 'mb-4'}>
        {!isMobile && (
          <label className="block text-sm font-semibold mb-2 text-gray-800">
            Saison propice <span className="text-red-500">*</span>
          </label>
        )}
        <div className={`flex ${isMobile ? 'gap-2' : 'gap-3'}`}>
          <button
            type="button"
            onClick={() => setSeason('été')}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 transition-all ${
              isMobile ? 'px-3 py-2' : 'px-4 py-2.5'
            } ${
              season === 'été'
                ? 'border-amber-500 bg-amber-50 text-amber-700'
                : 'border-gray-300 bg-white/50 text-gray-700 hover:border-amber-300'
            }`}
          >
            <Sun className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
            <span className={`font-medium ${isMobile ? 'text-sm' : ''}`}>Été</span>
          </button>
          <button
            type="button"
            onClick={() => setSeason('hiver')}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 transition-all ${
              isMobile ? 'px-3 py-2' : 'px-4 py-2.5'
            } ${
              season === 'hiver'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 bg-white/50 text-gray-700 hover:border-blue-300'
            }`}
          >
            <Snowflake className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
            <span className={`font-medium ${isMobile ? 'text-sm' : ''}`}>Hiver</span>
          </button>
        </div>
      </div>

      {/* Capacité d'accueil */}
      <div className={isMobile ? 'mb-3' : 'mb-4'}>
        {!isMobile && (
          <label className="block text-sm font-semibold mb-2 text-gray-800">
            Capacité d'accueil <span className="text-red-500">*</span>
          </label>
        )}
        {isMobile && (
          <label className="block text-sm font-medium mb-1.5 text-gray-700">
            Capacité
          </label>
        )}
        <div className={`grid grid-cols-4 ${isMobile ? 'gap-2' : 'gap-3'}`}>
          {[
            { value: '1' as const, label: '1' },
            { value: '2-3' as const, label: '2-3' },
            { value: '4-5' as const, label: '4-5' },
            { value: '5+' as const, label: '5+' }
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setCapacity(option.value)}
              className={`flex flex-col items-center justify-center rounded-lg border-2 transition-all ${
                isMobile ? 'px-2 py-2' : 'px-3 py-2.5'
              } ${
                capacity === option.value
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-gray-300 bg-white/50 text-gray-700 hover:border-emerald-300'
              }`}
            >
              <Tent className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} mb-1`} />
              <span className={`font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Difficulté d'accès */}
      <div className={isMobile ? 'mb-3' : 'mb-4'}>
        {!isMobile && (
          <label className="block text-sm font-semibold mb-2 text-gray-800">
            Difficulté d'accès <span className="text-red-500">*</span>
          </label>
        )}
        {isMobile && (
          <label className="block text-sm font-medium mb-1.5 text-gray-700">
            Difficulté (0 = facile, 5 = difficile)
          </label>
        )}
        <div className="flex items-center gap-2">
          {[0, 1, 2, 3, 4, 5].map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setDifficulty(level)}
              className={`flex-1 flex items-center justify-center rounded-lg border-2 transition-all ${
                isMobile ? 'h-10' : 'h-12'
              } ${
                difficulty === level
                  ? level === 0
                    ? 'border-gray-500 bg-gray-100 text-gray-700'
                    : level <= 2
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : level === 3
                    ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                    : 'border-red-500 bg-red-50 text-red-700'
                  : 'border-gray-300 bg-white/50 text-gray-600 hover:border-gray-400'
              }`}
            >
              <span className={`font-bold ${isMobile ? 'text-sm' : 'text-base'}`}>{level}</span>
            </button>
          ))}
        </div>
        {!isMobile && (
          <p className="text-xs text-gray-500 mt-1">
            0 = très facile • 1-2 = facile • 3 = moyen • 4-5 = difficile
          </p>
        )}
      </div>

      {/* Réglementation - Toggle */}
      <div className={isMobile ? 'mb-3' : 'mb-4'}>
        <label className={`flex items-center cursor-pointer border-2 border-gray-300 rounded-lg hover:border-orange-300 transition-colors bg-white ${
          isMobile ? 'gap-2 p-2' : 'gap-3 p-3'
        }`}>
          <input
            type="checkbox"
            checked={hasRegulations}
            onChange={(e) => setHasRegulations(e.target.checked)}
            className={`text-orange-600 rounded focus:ring-2 focus:ring-orange-500 ${
              isMobile ? 'w-4 h-4' : 'w-5 h-5'
            }`}
          />
          <div className="flex items-center gap-2">
            <AlertCircle className={`text-orange-600 ${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
            <span className={`font-medium text-gray-800 ${isMobile ? 'text-sm' : ''}`}>Réglementation spécifique</span>
          </div>
        </label>

        {/* Détails réglementation */}
        {hasRegulations && (
          <div className={`space-y-2 ${isMobile ? 'mt-2 ml-2' : 'mt-3 ml-3'}`}>
            {/* Checkbox pour parc national */}
            <label className={`flex items-start cursor-pointer border border-gray-300 rounded-lg hover:border-orange-300 transition-colors bg-white/20 ${
              isMobile ? 'gap-2 p-2' : 'gap-3 p-3'
            }`}>
              <input
                type="checkbox"
                checked={isNationalPark}
                onChange={(e) => setIsNationalPark(e.target.checked)}
                className={`mt-0.5 text-orange-600 rounded focus:ring-2 focus:ring-orange-500 ${
                  isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'
                }`}
              />
              <span className={`text-gray-800 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                Parc national - bivouac 19h à 9h
              </span>
            </label>

            {/* Champ texte libre */}
            <textarea
              value={regulationDetails}
              onChange={(e) => setRegulationDetails(e.target.value)}
              placeholder={isMobile ? "Autres restrictions..." : "Détails supplémentaires sur la réglementation..."}
              rows={isMobile ? 2 : 2}
              className={`w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none bg-white/50 ${
                isMobile ? 'px-3 py-2 text-xs' : 'px-3 py-2 text-sm'
              }`}
            />
          </div>
        )}
      </div>

      {/* Bouton de soumission */}
      <button
        type="submit"
        className={`w-full bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors ${
          isMobile ? 'py-2.5 text-sm' : 'py-3'
        }`}
      >
        {isMobile ? 'Créer le spot' : 'Soumettre le point de bivouac'}
      </button>
    </form>
  );
}