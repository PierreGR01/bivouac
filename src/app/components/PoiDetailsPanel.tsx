import React, { useState, useMemo } from 'react';
import { PoiLocation } from '../types';
import { X, Droplets, Snowflake, Sun, AlertCircle, MapPin, Shield, AlertTriangle, Mountain, Tent, Star, Trash2, Loader2 } from 'lucide-react';
import { ProtectedArea, findAreasContainingPoint, getProtectedAreaInfo } from '../services/protected-areas';
import { useAuth } from '../contexts/AuthContext';
import * as api from '/utils/supabase/api';

interface PoiDetailsPanelProps {
  location: PoiLocation | null;
  onClose: () => void;
  protectedAreas?: ProtectedArea[];
}

export function PoiDetailsPanel({ location, onClose, protectedAreas = [] }: PoiDetailsPanelProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  if (!location) return null;

  // Vérifier si le POI est dans une zone protégée
  const areasContainingPoi = useMemo(() => {
    if (!location || protectedAreas.length === 0) return [];
    return findAreasContainingPoint(
      { lat: location.position.lat, lng: location.position.lng },
      protectedAreas
    );
  }, [location, protectedAreas]);

  const getSeasonIcon = () => {
    switch (location.season) {
      case 'hiver':
        return <Snowflake className="w-5 h-5" />;
      case 'été':
        return <Sun className="w-5 h-5" />;
      default:
        return <Sun className="w-5 h-5" />;
    }
  };

  const getSeasonStyle = () => {
    switch (location.season) {
      case 'hiver':
        return 'bg-slate-100 text-slate-700';
      case 'été':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-amber-50 text-amber-700';
    }
  };

  return (
    <>
      {/* Modal photo en plein écran (mobile uniquement) */}
      {isPhotoModalOpen && location.photos && location.photos.length > 0 && (
        <div 
          className="md:hidden fixed inset-0 bg-black z-[1100] flex items-center justify-center"
          onClick={() => setIsPhotoModalOpen(false)}
        >
          <button
            onClick={() => setIsPhotoModalOpen(false)}
            className="absolute top-4 right-4 p-2 bg-white bg-opacity-90 rounded-full shadow-lg hover:bg-opacity-100 transition-colors z-10"
          >
            <X className="w-6 h-6 text-gray-800" />
          </button>
          <img
            src={location.photos[currentPhotoIndex]}
            alt={location.title}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {/* Indicateurs de photos dans la modal */}
          {location.photos.length > 1 && (
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex justify-center gap-2">
              {location.photos.map((_, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentPhotoIndex(index);
                  }}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentPhotoIndex 
                      ? 'bg-white w-6' 
                      : 'bg-white bg-opacity-50 hover:bg-opacity-75'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mobile: panneau du bas - limité à 2/3 de l'écran */}
      <div 
        className="md:hidden fixed inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl z-[1000] max-w-full overflow-hidden"
        style={{
          maxHeight: '66.67vh', // 2/3 de l'écran
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
        <div className="overflow-y-auto px-6 pb-6 max-w-full" style={{ maxHeight: 'calc(66.67vh - 60px)' }}>
          <PanelContent 
            location={location} 
            currentPhotoIndex={currentPhotoIndex}
            setCurrentPhotoIndex={setCurrentPhotoIndex}
            areasContainingPoi={areasContainingPoi}
            getSeasonIcon={getSeasonIcon}
            getSeasonStyle={getSeasonStyle}
            isMobile={true}
            onPhotoClick={() => setIsPhotoModalOpen(true)}
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
        <div className="overflow-y-auto px-6 py-6 max-w-full" style={{ maxHeight: 'calc(100vh - 10.5rem)' }}>
          <PanelContent 
            location={location} 
            currentPhotoIndex={currentPhotoIndex}
            setCurrentPhotoIndex={setCurrentPhotoIndex}
            getSeasonIcon={getSeasonIcon}
            getSeasonStyle={getSeasonStyle}
            onClose={onClose}
            areasContainingPoi={areasContainingPoi}
            isMobile={false}
          />
        </div>
      </div>
    </>
  );
}

// Composant pour le contenu partagé
function PanelContent({
  location,
  currentPhotoIndex,
  setCurrentPhotoIndex,
  getSeasonIcon,
  getSeasonStyle,
  onClose,
  areasContainingPoi = [],
  isMobile = false,
  onPhotoClick
}: {
  location: PoiLocation;
  currentPhotoIndex: number;
  setCurrentPhotoIndex: (index: number) => void;
  getSeasonIcon: () => JSX.Element;
  getSeasonStyle: () => string;
  onClose?: () => void;
  areasContainingPoi?: ProtectedArea[];
  isMobile?: boolean;
  onPhotoClick?: () => void;
}) {
  const { isAdmin } = useAuth();
  const [newRating, setNewRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [localRatings, setLocalRatings] = useState<number[]>(location.ratings || []);

  // Calculer la moyenne des notes
  const averageRating = useMemo(() => {
    if (!localRatings || localRatings.length === 0) return 0;
    return localRatings.reduce((acc, r) => acc + r, 0) / localRatings.length;
  }, [localRatings]);

  // Fonction pour soumettre une note
  const handleSubmitRating = async () => {
    if (newRating === 0) return;

    setIsSubmittingRating(true);
    try {
      const updatedPoi = await api.addRating(location.id, newRating);
      if (updatedPoi && updatedPoi.ratings) {
        setLocalRatings(updatedPoi.ratings);
        setNewRating(0);
        alert(`Note de ${newRating}/5 ajoutée avec succès !`);
      } else {
        // En cas d'erreur serveur, ajouter la note localement
        setLocalRatings([...localRatings, newRating]);
        setNewRating(0);
        alert(`Note de ${newRating}/5 ajoutée localement. Le serveur n'est peut-être pas disponible.`);
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la note:', error);
      // Ajouter localement même en cas d'erreur
      setLocalRatings([...localRatings, newRating]);
      setNewRating(0);
      alert(`Note de ${newRating}/5 ajoutée localement. Le serveur n'est peut-être pas disponible.`);
    } finally {
      setIsSubmittingRating(false);
    }
  };

  // Fonction pour supprimer un POI
  const handleDeletePoi = async () => {
    setIsDeleting(true);
    try {
      await api.deletePoi(location.id);
      alert('Spot supprimé avec succès');
      onClose?.();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      alert('Erreur lors de la suppression du spot');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
      {/* En-tête avec titre et bouton fermer (desktop uniquement) */}
      {onClose && (
        <div className="flex items-center justify-between mb-4 gap-3">
          <h2 className="text-xl font-bold text-gray-800 drop-shadow-sm break-words flex-1">{location.title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5 text-gray-800" />
          </button>
        </div>
      )}

      {/* Galerie photos */}
      {location.photos && location.photos.length > 0 && (
        <div className="relative mb-4">
          {/* Version mobile : miniatures cliquables */}
          {isMobile ? (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {location.photos.map((photo, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setCurrentPhotoIndex(index);
                    onPhotoClick?.();
                  }}
                  className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                    index === currentPhotoIndex 
                      ? 'border-emerald-500' 
                      : 'border-transparent hover:border-gray-300'
                  }`}
                  style={{ height: '35px', width: '52px' }}
                >
                  <img
                    src={photo}
                    alt={`${location.title} - Photo ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          ) : (
            /* Version desktop : image en pleine taille */
            <>
              <div className="aspect-video bg-gray-200 rounded-2xl overflow-hidden">
                <img
                  src={location.photos[currentPhotoIndex]}
                  alt={location.title}
                  className="w-full h-full object-cover"
                />
              </div>
              
              {/* Indicateurs de photos */}
              {location.photos.length > 1 && (
                <div className="flex justify-center gap-2 mt-3">
                  {location.photos.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentPhotoIndex(index)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        index === currentPhotoIndex 
                          ? 'bg-emerald-500 w-6' 
                          : 'bg-gray-300 hover:bg-gray-400'
                      }`}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Titre (mobile uniquement) */}
      {!onClose && <h2 className="text-2xl font-bold mb-2 break-words">{location.title}</h2>}

      {/* Localisation */}
      <div className="flex items-center gap-2 text-gray-600 mb-3">
        <MapPin className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm break-all">
          {location.position.lat.toFixed(4)}°N, {location.position.lng.toFixed(4)}°E
        </span>
      </div>

      {/* Badges d'informations */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Saison */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${getSeasonStyle()}`}>
          {getSeasonIcon()}
          <span className="text-sm font-medium capitalize">{location.season}</span>
        </div>

        {/* Point d'eau */}
        {location.waterProximity && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
            location.waterProximity === 'proche'
              ? 'bg-blue-50 text-blue-700' 
              : 'bg-sky-50 text-sky-700'
          }`}>
            <Droplets className="w-5 h-5" />
            <span className="text-sm font-medium">
              {location.waterProximity === 'proche' 
                ? 'Point d\'eau à proximité (<100m)' 
                : 'Point d\'eau éloigné (100-200m)'}
            </span>
          </div>
        )}
        
        {!location.waterProximity && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-gray-600">
            <Droplets className="w-5 h-5" />
            <span className="text-sm font-medium">
              Pas de point d'eau connu à proximité
            </span>
          </div>
        )}
      </div>

      {/* Description */}
      <div className="mb-4">
        <h3 className="font-semibold text-base mb-2 text-gray-800">Description</h3>
        <p className="text-gray-700 leading-relaxed text-sm">{location.description}</p>
      </div>

      {/* Informations détaillées (Altitude, Capacité, Difficulté) */}
      <div className="mb-4 bg-gray-50 rounded-lg p-4 space-y-3">
        {/* Altitude */}
        {location.altitude !== undefined && location.altitude !== null && (
          <div className="flex items-center gap-3">
            <Mountain className="w-5 h-5 text-gray-700" />
            <div className="flex-1">
              <span className="text-sm font-semibold text-gray-700">Altitude</span>
              <p className="text-sm text-gray-600">{location.altitude}m</p>
            </div>
          </div>
        )}

        {/* Capacité */}
        {location.capacity && (
          <div className="flex items-center gap-3">
            <Tent className="w-5 h-5 text-gray-700" />
            <div className="flex-1">
              <span className="text-sm font-semibold text-gray-700">Capacité</span>
              <p className="text-sm text-gray-600">
                {location.capacity === '1' && '1 tente'}
                {location.capacity === '2-3' && '2-3 tentes'}
                {location.capacity === '4-5' && '4-5 tentes'}
                {location.capacity === '5+' && 'Plus de 5 tentes'}
              </p>
            </div>
          </div>
        )}

        {/* Difficulté */}
        {location.difficulty !== undefined && location.difficulty !== null && (
          <div className="flex items-center gap-3">
            <Mountain className="w-5 h-5 text-gray-700" />
            <div className="flex-1">
              <span className="text-sm font-semibold text-gray-700">Difficulté d'accès</span>
              <div className="flex items-center gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((level) => {
                  // Dégradé de couleurs du vert au rouge
                  const getColor = (lvl: number) => {
                    if (lvl === 1) return 'bg-green-500 text-white';
                    if (lvl === 2) return 'bg-lime-500 text-white';
                    if (lvl === 3) return 'bg-yellow-500 text-white';
                    if (lvl === 4) return 'bg-orange-500 text-white';
                    if (lvl === 5) return 'bg-red-500 text-white';
                    return 'bg-gray-200 text-gray-400';
                  };
                  
                  return (
                    <div
                      key={level}
                      className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                        location.difficulty && location.difficulty >= level
                          ? getColor(level)
                          : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {level === location.difficulty ? level : ''}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Alerte zone protégée */}
      {areasContainingPoi.length > 0 && (
        <div className="mb-4 space-y-3">
          {areasContainingPoi.map((area) => {
            const info = getProtectedAreaInfo(area);
            return (
              <div 
                key={area.id}
                className={`border-l-4 p-4 rounded-r-lg ${
                  info.isCampingForbidden 
                    ? 'bg-red-50 border-red-500' 
                    : 'bg-orange-50 border-orange-500'
                }`}
              >
                <div className="flex items-start gap-3">
                  {info.isCampingForbidden ? (
                    <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Shield className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className={`font-bold text-base ${
                        info.isCampingForbidden ? 'text-red-900' : 'text-orange-900'
                      }`}>
                        {info.isCampingForbidden ? '⚠️ Zone interdite' : '📍 Zone réglementée'}
                      </h3>
                    </div>
                    <p className={`font-semibold text-sm mb-2 ${
                      info.isCampingForbidden ? 'text-red-800' : 'text-orange-800'
                    }`}>
                      {info.title}
                    </p>
                    {info.description && (
                      <p className={`text-sm mb-3 ${
                        info.isCampingForbidden ? 'text-red-700' : 'text-orange-700'
                      }`}>
                        {info.description}
                      </p>
                    )}
                    {info.restrictions.length > 0 && (
                      <ul className="space-y-1.5">
                        {info.restrictions.map((restriction, idx) => (
                          <li 
                            key={idx}
                            className={`text-sm flex items-start gap-2 ${
                              info.isCampingForbidden ? 'text-red-800' : 'text-orange-800'
                            }`}
                          >
                            <span className="flex-shrink-0">•</span>
                            <span>{restriction}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {area.tags.website && (
                      <a
                        href={area.tags.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-block mt-3 text-sm font-medium underline ${
                          info.isCampingForbidden 
                            ? 'text-red-700 hover:text-red-900' 
                            : 'text-orange-700 hover:text-orange-900'
                        }`}
                      >
                        Plus d'informations →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Réglementation du spot */}
      {location.regulations && (
        <div className="bg-orange-50 border-l-4 border-orange-400 p-3 rounded-r-lg mb-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-orange-900 mb-1 text-sm">Réglementation du spot</h3>
              <p className="text-sm text-orange-800">{location.regulations}</p>
            </div>
          </div>
        </div>
      )}

      {/* Évaluation */}
      <div className="mb-4 bg-amber-50 rounded-lg p-4">
        <h3 className="font-semibold text-base mb-2 text-gray-800">Évaluation du spot</h3>
        
        {/* Affichage de la moyenne */}
        {localRatings.length > 0 ? (
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-5 h-5 ${
                    star <= Math.round(averageRating) 
                      ? 'fill-yellow-500 text-yellow-500' 
                      : 'text-gray-300'
                  }`}
                />
              ))}
            </div>
            <span className="text-sm font-semibold text-gray-700">
              {averageRating.toFixed(1)}/5
            </span>
            <span className="text-xs text-gray-500">
              ({localRatings.length} {localRatings.length > 1 ? 'avis' : 'avis'})
            </span>
          </div>
        ) : (
          <p className="text-sm text-gray-600 mb-4">Aucune évaluation pour le moment</p>
        )}
        
        {/* Interface pour ajouter une note */}
        <div className="border-t border-amber-200 pt-3">
          <p className="text-sm font-medium text-gray-700 mb-2">Notez ce spot :</p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-6 h-6 cursor-pointer transition-all ${
                    (hoverRating >= star || (!hoverRating && newRating >= star))
                      ? 'fill-yellow-500 text-yellow-500 scale-110' 
                      : 'text-gray-300 hover:text-yellow-400'
                  }`}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setNewRating(star)}
                />
              ))}
            </div>
            {newRating > 0 && (
              <button
                onClick={handleSubmitRating}
                disabled={isSubmittingRating}
                className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:bg-gray-400"
              >
                {isSubmittingRating ? 'Envoi...' : 'Valider'}
              </button>
            )}
          </div>
          {newRating > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              Votre note : {newRating}/5
            </p>
          )}
        </div>
      </div>

      {/* Bouton de suppression pour les admins */}
      {isAdmin && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          {showDeleteConfirm ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-800 font-medium mb-3">
                Êtes-vous sûr de vouloir supprimer ce spot ? Cette action est irréversible.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDeletePoi}
                  disabled={isDeleting}
                  className="flex-1 bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 disabled:bg-red-400 transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Suppression...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Confirmer la suppression
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="flex-1 bg-gray-200 text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-colors font-medium"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full bg-red-50 text-red-700 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-2 font-medium border border-red-200"
            >
              <Trash2 className="w-4 h-4" />
              Supprimer ce spot
            </button>
          )}
        </div>
      )}
    </>
  );
}