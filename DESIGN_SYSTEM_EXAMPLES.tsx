/**
 * EXEMPLES D'UTILISATION DU DESIGN SYSTEM BIVOUAC
 * 
 * Ce fichier contient des exemples concrets d'utilisation des composants
 * du design system dans différents contextes de l'application.
 */

import React from 'react';
import {
  BivouacButton,
  SeasonBadge,
  CountBadge,
  StatusBadge,
  Card,
  InfoCard,
  AlertCard,
  Input,
  Textarea,
  Select,
  Checkbox,
  RangeSlider,
  Panel,
  PanelHeader,
  PanelSection,
  PanelActions,
} from './src/app/components/ui/bivouac-ui';
import { Plus, Route, Trash2, Check, Tent, Droplet, Leaf, Sun, Snowflake } from 'lucide-react';

// ============================================
// EXEMPLE 1 : BOUTONS
// ============================================

export function ButtonExamples() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <h3 className="text-lg font-bold">Boutons</h3>
      
      {/* Bouton principal avec icône */}
      <BivouacButton variant="primary" icon={<Plus className="w-5 h-5" />}>
        Ajouter un spot
      </BivouacButton>
      
      {/* Bouton secondaire pour itinéraire */}
      <BivouacButton variant="secondary" icon={<Route className="w-5 h-5" />}>
        Tracer un itinéraire
      </BivouacButton>
      
      {/* Bouton outline */}
      <BivouacButton variant="outline">
        Annuler
      </BivouacButton>
      
      {/* Bouton destructif */}
      <BivouacButton variant="destructive" icon={<Trash2 className="w-5 h-5" />}>
        Supprimer
      </BivouacButton>
      
      {/* Bouton ghost (fermeture) */}
      <BivouacButton variant="ghost" size="sm">
        <span className="sr-only">Fermer</span>
      </BivouacButton>
      
      {/* Tailles différentes */}
      <div className="flex gap-2">
        <BivouacButton size="sm">Petit</BivouacButton>
        <BivouacButton size="md">Moyen</BivouacButton>
        <BivouacButton size="lg">Grand</BivouacButton>
      </div>
      
      {/* Bouton désactivé */}
      <BivouacButton disabled>
        Bouton désactivé
      </BivouacButton>
    </div>
  );
}

// ============================================
// EXEMPLE 2 : BADGES
// ============================================

export function BadgeExamples() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <h3 className="text-lg font-bold">Badges</h3>
      
      {/* Badges de saison avec icônes */}
      <div className="flex gap-2">
        <SeasonBadge season="printemps" icon={<Leaf className="w-3 h-3" />} />
        <SeasonBadge season="été" icon={<Sun className="w-3 h-3" />} />
        <SeasonBadge season="hiver" icon={<Snowflake className="w-3 h-3" />} />
        <SeasonBadge season="toute saison" />
      </div>
      
      {/* Badge de compteur */}
      <div className="flex items-center gap-2">
        <span>Filtres actifs</span>
        <CountBadge count={3} />
      </div>
      
      {/* Badges de status */}
      <div className="flex gap-2">
        <StatusBadge status="success">Disponible</StatusBadge>
        <StatusBadge status="warning">Limité</StatusBadge>
        <StatusBadge status="error">Interdit</StatusBadge>
        <StatusBadge status="info">Information</StatusBadge>
      </div>
    </div>
  );
}

// ============================================
// EXEMPLE 3 : CARDS
// ============================================

export function CardExamples() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <h3 className="text-lg font-bold">Cards</h3>
      
      {/* Card standard */}
      <Card>
        <h4 className="font-bold mb-2">Titre de la card</h4>
        <p className="text-sm text-gray-600">
          Contenu de la card avec du texte descriptif.
        </p>
      </Card>
      
      {/* Info Cards - Statistiques */}
      <div className="grid grid-cols-2 gap-3">
        <InfoCard title="Points d'itinéraire" value={5} variant="blue" />
        <InfoCard title="Spots à proximité" value={12} variant="emerald" />
      </div>
      
      {/* Alert Cards */}
      <AlertCard type="success">
        <p className="text-sm">
          Votre spot a été ajouté avec succès !
        </p>
      </AlertCard>
      
      <AlertCard type="warning">
        <p className="text-sm">
          Le serveur n'est pas disponible. Vos données sont sauvegardées localement.
        </p>
      </AlertCard>
      
      <AlertCard type="info">
        <p className="text-sm">
          Cliquez sur la carte pour placer des points et créer votre itinéraire.
        </p>
      </AlertCard>
    </div>
  );
}

// ============================================
// EXEMPLE 4 : FORMULAIRES
// ============================================

export function FormExamples() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <h3 className="text-lg font-bold">Formulaires</h3>
      
      {/* Input avec label */}
      <Input
        label="Titre du spot"
        placeholder="Ex: Bivouac au lac des Chéserys"
      />
      
      {/* Input avec erreur */}
      <Input
        label="Localisation"
        placeholder="Coordonnées GPS"
        error="Les coordonnées sont invalides"
      />
      
      {/* Textarea */}
      <Textarea
        label="Description"
        placeholder="Décrivez votre spot de bivouac..."
        rows={4}
      />
      
      {/* Select */}
      <Select
        label="Saison propice"
        options={[
          { value: 'printemps', label: 'Printemps' },
          { value: 'été', label: 'Été' },
          { value: 'hiver', label: 'Hiver' },
          { value: 'toute saison', label: 'Toute saison' },
        ]}
      />
      
      {/* Checkbox */}
      <Checkbox label="Point d'eau à proximité" />
      
      {/* Range Slider */}
      <RangeSlider
        label="Distance maximale de l'itinéraire"
        min={0.5}
        max={10}
        step={0.5}
        value={2}
        unit="km"
        displayValue={2}
      />
    </div>
  );
}

// ============================================
// EXEMPLE 5 : PANEL COMPLET
// ============================================

export function PanelExample() {
  const [isOpen, setIsOpen] = React.useState(true);
  
  if (!isOpen) return null;
  
  return (
    <Panel onClose={() => setIsOpen(false)}>
      <PanelHeader
        title="Tracer un itinéraire"
        icon={<Route className="w-5 h-5 text-blue-600" />}
        onClose={() => setIsOpen(false)}
      />
      
      <PanelSection>
        <AlertCard type="info">
          <p className="text-sm">
            Cliquez sur la carte pour placer des points et créer votre itinéraire.
          </p>
        </AlertCard>
      </PanelSection>
      
      <PanelSection>
        <div className="grid grid-cols-2 gap-3">
          <InfoCard title="Points d'itinéraire" value={5} variant="blue" />
          <InfoCard title="Spots à proximité" value={12} variant="emerald" />
        </div>
      </PanelSection>
      
      <PanelSection>
        <Checkbox label="Tracé intelligent - Suit les chemins sur la carte" />
      </PanelSection>
      
      <PanelSection>
        <RangeSlider
          label="Distance maximale de l'itinéraire"
          min={0.5}
          max={10}
          step={0.5}
          value={2}
          unit="km"
          displayValue={2}
        />
      </PanelSection>
      
      <PanelActions>
        <BivouacButton
          variant="destructive"
          icon={<Trash2 className="w-5 h-5" />}
          className="flex-1"
        >
          Effacer
        </BivouacButton>
        <BivouacButton
          variant="primary"
          icon={<Check className="w-5 h-5" />}
          className="flex-1"
        >
          Terminer
        </BivouacButton>
      </PanelActions>
    </Panel>
  );
}

// ============================================
// EXEMPLE 6 : COMPOSITION COMPLÈTE - DÉTAILS POI
// ============================================

export function PoiDetailsExample() {
  return (
    <Panel onClose={() => {}}>
      <PanelHeader
        title="Bivouac au lac des Chéserys"
        icon={<Tent className="w-5 h-5 text-emerald-600" />}
      />
      
      {/* Saison et point d'eau */}
      <PanelSection>
        <div className="flex gap-2">
          <SeasonBadge season="été" icon={<Sun className="w-3 h-3" />} />
          <StatusBadge status="info">
            <Droplet className="w-3 h-3" />
            Point d'eau disponible
          </StatusBadge>
        </div>
      </PanelSection>
      
      {/* Description */}
      <PanelSection>
        <p className="text-sm text-gray-700">
          Magnifique spot au-dessus de Chamonix avec vue sur le Mont-Blanc. 
          Accessible après 3h de marche depuis Argentière. Point d'eau au lac.
        </p>
      </PanelSection>
      
      {/* Statistiques */}
      <PanelSection>
        <div className="grid grid-cols-2 gap-3">
          <InfoCard title="Altitude" value="2100m" variant="blue" />
          <InfoCard title="Difficulté" value="Moyen" variant="orange" />
        </div>
      </PanelSection>
      
      {/* Réglementation */}
      <PanelSection>
        <AlertCard type="success">
          <p className="text-sm font-medium">Bivouac autorisé</p>
          <p className="text-xs mt-1">Zone hors cœur du parc national</p>
        </AlertCard>
      </PanelSection>
      
      {/* Photos (placeholder) */}
      <PanelSection>
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-square bg-gray-200 rounded-lg" />
          ))}
        </div>
      </PanelSection>
      
      <PanelActions>
        <BivouacButton variant="outline" className="flex-1">
          Partager
        </BivouacButton>
        <BivouacButton variant="primary" className="flex-1">
          Y aller
        </BivouacButton>
      </PanelActions>
    </Panel>
  );
}

// ============================================
// EXEMPLE 7 : UTILISATION DES TOKENS CSS
// ============================================

export function TokensExample() {
  return (
    <div className="p-6">
      <h3 className="text-lg font-bold mb-4">Utilisation des CSS Tokens</h3>
      
      {/* Utilisation directe des variables CSS */}
      <div
        style={{
          backgroundColor: 'var(--color-season-spring)',
          color: 'white',
          padding: 'var(--spacing-panel-content)',
          borderRadius: 'var(--panel-radius-top)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        Composant avec tokens CSS directs
      </div>
      
      {/* Utilisation des classes utilitaires */}
      <div className="panel-desktop">
        Panel avec classe utilitaire
      </div>
      
      {/* Marqueurs avec classes */}
      <div className="flex gap-4 mt-4">
        <div className="marker-spring" />
        <div className="marker-summer" />
        <div className="marker-winter" />
        <div className="marker-temporary" />
      </div>
    </div>
  );
}
