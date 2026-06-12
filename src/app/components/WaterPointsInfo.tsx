import React from 'react';
import { AlertCircle, Droplet } from 'lucide-react';

interface WaterPointsInfoProps {
  onClose: () => void;
}

export function WaterPointsInfo({ onClose }: WaterPointsInfoProps) {
  return (
    <div className="fixed inset-0 z-[1100] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-sky-100 rounded-lg">
            <Droplet className="w-6 h-6 text-sky-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900">Points d'eau OpenStreetMap</h3>
            <p className="text-sm text-gray-600 mt-1">
              Les points d'eau sont extraits en temps réel depuis OpenStreetMap.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-blue-50 rounded-lg p-3">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">ℹ️ Comment ça marche ?</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Maximum 35 points d'eau affichés simultanément</li>
              <li>• Priorité aux points proches des spots de bivouac</li>
              <li>• Bleu = fontaine / source / puits</li>
              <li>• Teal (bleu-vert) = lac / plan d'eau naturel</li>
              <li>• Les cours d'eau ne sont pas affichés (pris en compte dans la fiche spot)</li>
              <li>• Cliquez sur un point pour voir les détails</li>
            </ul>
          </div>

          <div className="bg-yellow-50 rounded-lg p-3">
            <h4 className="text-sm font-semibold text-yellow-900 mb-2">⚠️ Limitations importantes</h4>
            <ul className="text-xs text-yellow-800 space-y-1">
              <li>• <strong>Zoomez suffisamment</strong> avant d'activer (zone max ~55km)</li>
              <li>• <strong>5 secondes minimum</strong> entre chaque requête</li>
              <li>• Évitez de déplacer la carte trop rapidement</li>
              <li>• Cache de 10 minutes pour réduire les requêtes</li>
              <li>• En cas d'erreur, zoomez plus ou patientez</li>
              <li>• Vérifiez toujours la potabilité sur place</li>
            </ul>
          </div>

          <div className="bg-emerald-50 rounded-lg p-3">
            <h4 className="text-sm font-semibold text-emerald-900 mb-2">✓ Conseils</h4>
            <ul className="text-xs text-emerald-800 space-y-1">
              <li>• <strong>Naviguez d'abord</strong>, puis activez les points d'eau</li>
              <li>• <strong>Zoomez bien</strong> sur la zone qui vous intéresse</li>
              <li>• Enregistrez des spots de bivouac pour prioriser les points proches</li>
              <li>• Le compteur indique combien de points sont disponibles</li>
              <li>• Les données proviennent de la communauté OSM</li>
            </ul>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 px-4 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700 transition-colors"
        >
          J'ai compris
        </button>
      </div>
    </div>
  );
}
