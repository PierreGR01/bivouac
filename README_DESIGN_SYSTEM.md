# 🎨 Design System Bivouac - Guide d'utilisation

## 📋 Vue d'ensemble

Ce design system complet a été extrait et documenté à partir de votre prototype d'application de signalement de points de bivouac. Il fournit une base cohérente et réutilisable pour le développement de l'application.

## 📁 Structure des fichiers

```
/DESIGN_SYSTEM.md                    # Documentation complète du design system
/DESIGN_SYSTEM_EXAMPLES.tsx          # Exemples d'utilisation des composants
/README_DESIGN_SYSTEM.md             # Ce fichier - Guide de démarrage

/src/styles/
  ├── design-tokens.css               # Tokens CSS (couleurs, espacements, animations)
  ├── theme.css                       # Thème de base (existant)
  └── index.css                       # Import centralisé (mis à jour)

/src/app/components/ui/
  ├── bivouac-button.tsx              # Composant Bouton
  ├── bivouac-badge.tsx               # Composants Badges (saison, count, status)
  ├── bivouac-card.tsx                # Composants Cards (standard, info, alert)
  ├── bivouac-input.tsx               # Composants Formulaires (input, textarea, select, etc.)
  ├── bivouac-panel.tsx               # Composant Panel responsive
  └── bivouac-ui.tsx                  # Export centralisé de tous les composants
```

## 🚀 Démarrage rapide

### 1. Import des composants

```tsx
import {
  BivouacButton,
  SeasonBadge,
  InfoCard,
  Input,
  Panel,
  PanelHeader,
  PanelSection,
  PanelActions
} from '@/components/ui/bivouac-ui';
```

### 2. Utilisation basique

```tsx
// Bouton principal
<BivouacButton variant="primary" icon={<Plus />}>
  Ajouter un spot
</BivouacButton>

// Badge de saison
<SeasonBadge season="été" icon={<Sun />} />

// Card d'information
<InfoCard title="Points d'itinéraire" value={5} variant="blue" />

// Input
<Input label="Titre" placeholder="Nom du spot..." />
```

### 3. Composition d'un panel complet

```tsx
<Panel onClose={() => setIsOpen(false)}>
  <PanelHeader 
    title="Mon Panel" 
    icon={<Tent />}
  />
  
  <PanelSection>
    <AlertCard type="info">Message d'information</AlertCard>
  </PanelSection>
  
  <PanelSection>
    <Input label="Champ" />
  </PanelSection>
  
  <PanelActions>
    <BivouacButton variant="outline">Annuler</BivouacButton>
    <BivouacButton variant="primary">Valider</BivouacButton>
  </PanelActions>
</Panel>
```

## 🎨 Composants disponibles

### Boutons
- **Variants**: `primary`, `secondary`, `outline`, `destructive`, `ghost`
- **Sizes**: `sm`, `md`, `lg`
- **Props**: `icon`, `disabled`, `className`

### Badges
- **SeasonBadge**: Affiche une saison avec icône
- **CountBadge**: Badge numérique circulaire
- **StatusBadge**: Badge de statut (success, warning, error, info)

### Cards
- **Card**: Card standard avec shadow
- **InfoCard**: Card statistique avec titre et valeur
- **AlertCard**: Card d'alerte avec bordure latérale colorée

### Formulaires
- **Input**: Input texte avec label et erreur
- **Textarea**: Zone de texte multiligne
- **Select**: Menu déroulant
- **Checkbox**: Case à cocher avec label
- **RangeSlider**: Slider avec valeur affichée

### Panels
- **Panel**: Container responsive (mobile bottom, desktop left)
- **PanelHeader**: En-tête avec titre, icône et bouton fermer
- **PanelSection**: Section de contenu avec espacement
- **PanelActions**: Container pour boutons d'action

## 🎯 Système de couleurs

### Par saison
- **Printemps**: Vert émeraude (`#10b981`)
- **Été**: Orange (`#ea580c`)
- **Hiver**: Gris ardoise (`#64748b`)

### Fonctionnelles
- **Route**: Bleu (`#2563eb`)
- **Success**: Vert (`#10b981`)
- **Warning**: Ambre (`#f59e0b`)
- **Error**: Rouge (`#ef4444`)

## 📐 Espacements

- **Panel gap**: `2px` (entre SearchBar et panels)
- **Section gap**: `1rem` (16px)
- **Grid gap**: `0.75rem` (12px) pour cards proches
- **Inline gap**: `0.5rem` (8px) pour éléments inline

## 📱 Responsive

Le design system utilise une approche **mobile-first** avec un breakpoint principal à `768px` (`md:`).

### Patterns responsive
```tsx
{/* Mobile: bottom panel, Desktop: left sidebar */}
<div className="md:hidden ...">Mobile</div>
<div className="hidden md:block ...">Desktop</div>

{/* Full width mobile, fixed width desktop */}
<div className="md:w-[480px] ...">Content</div>
```

## 🎬 Animations

Trois animations principales sont disponibles :

1. **slideUp**: Pour les panels mobiles (bottom)
2. **fadeIn**: Pour les panels desktop (fade + slight move)
3. **pulse**: Pour les marqueurs temporaires

Utilisation via tokens CSS :
```css
animation: var(--animation-slide-up);
animation: var(--animation-fade-in);
animation: var(--animation-pulse);
```

## 🔧 Tokens CSS

Les tokens sont définis dans `/src/styles/design-tokens.css` et peuvent être utilisés directement :

```tsx
// Dans du style inline
style={{
  backgroundColor: 'var(--color-season-spring)',
  padding: 'var(--spacing-panel-content)',
  borderRadius: 'var(--panel-radius-top)',
  boxShadow: 'var(--shadow-card)',
}}

// Ou via des classes utilitaires prédéfinies
className="panel-desktop"
className="marker-spring"
className="searchbar-container"
```

## 📊 Z-Index Scale

Ordre de superposition des éléments :
- **Map**: `0`
- **Panels**: `500`
- **SearchBar**: `600`
- **Mobile Panel**: `1000`
- **Modal**: `1100`

Variables disponibles :
```css
--z-map: 0;
--z-panels: 500;
--z-searchbar: 600;
--z-mobile-panel: 1000;
--z-modal: 1100;
```

## 🎭 Iconographie

Le design system utilise **Lucide React** pour les icônes.

### Tailles standards
- **Small**: `w-4 h-4` (16px)
- **Default**: `w-5 h-5` (20px)
- **Large**: `w-6 h-6` (24px)

### Icônes principales
```tsx
import { 
  Tent,        // Bivouac
  Route,       // Itinéraire
  Plus,        // Ajouter
  Search,      // Recherche
  Droplet,     // Point d'eau
  Leaf,        // Printemps
  Sun,         // Été
  Snowflake,   // Hiver
  Check,       // Valider
  X,           // Fermer
  Trash2       // Supprimer
} from 'lucide-react';
```

## 🧪 Exemples pratiques

Consultez le fichier `/DESIGN_SYSTEM_EXAMPLES.tsx` pour voir :

1. ✅ Tous les variants de boutons
2. 🏷️ Tous les types de badges
3. 📇 Compositions de cards
4. 📝 Tous les composants de formulaire
5. 📱 Panel complet avec toutes les sections
6. 🎨 Utilisation directe des tokens CSS
7. 🏕️ Exemple complet : Détails d'un POI

## 🎓 Bonnes pratiques

### ✅ À faire

1. **Utiliser les composants du design system** plutôt que de recréer des composants similaires
2. **Respecter les variants** définis (primary, secondary, etc.)
3. **Utiliser les tokens CSS** pour les valeurs récurrentes
4. **Suivre les patterns responsive** (mobile bottom, desktop left)
5. **Conserver l'espacement de 2px** entre SearchBar et panels

### ❌ À éviter

1. ❌ Créer des variantes de couleurs non documentées
2. ❌ Modifier directement les composants du design system sans documentation
3. ❌ Utiliser des espacements arbitraires au lieu des tokens
4. ❌ Ignorer les patterns responsive établis
5. ❌ Mixer les styles inline et Tailwind sans raison

## 🔄 Extension du design system

Pour ajouter un nouveau composant :

1. **Créer le composant** dans `/src/app/components/ui/bivouac-[nom].tsx`
2. **Documenter** dans `/DESIGN_SYSTEM.md`
3. **Ajouter des exemples** dans `/DESIGN_SYSTEM_EXAMPLES.tsx`
4. **Exporter** depuis `/src/app/components/ui/bivouac-ui.tsx`
5. **Utiliser les tokens** existants autant que possible

### Template de nouveau composant

```tsx
import React from 'react';
import { cn } from '@/lib/utils';

interface MyComponentProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'alternative';
  children: React.ReactNode;
}

export function MyComponent({ 
  variant = 'default', 
  children, 
  className,
  ...props 
}: MyComponentProps) {
  return (
    <div
      className={cn(
        'base-classes',
        variant === 'alternative' && 'alternative-classes',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
```

## 📚 Ressources

- **Documentation complète**: `/DESIGN_SYSTEM.md`
- **Exemples de code**: `/DESIGN_SYSTEM_EXAMPLES.tsx`
- **Tokens CSS**: `/src/styles/design-tokens.css`
- **Composants UI**: `/src/app/components/ui/`
- **Icônes**: [Lucide React](https://lucide.dev/)

## 🆘 Support

Pour toute question sur le design system :

1. Consultez d'abord `/DESIGN_SYSTEM.md`
2. Regardez les exemples dans `/DESIGN_SYSTEM_EXAMPLES.tsx`
3. Vérifiez les tokens dans `/src/styles/design-tokens.css`
4. Inspectez les composants existants pour voir leur utilisation

## 🎉 Conclusion

Ce design system fournit une base solide et cohérente pour votre application de bivouac. Il permet :

- ✨ **Cohérence visuelle** à travers toute l'application
- 🚀 **Développement rapide** avec des composants réutilisables
- 📱 **Responsive par défaut** avec patterns établis
- 🎨 **Thématique outdoor** adaptée au contexte bivouac
- 🔧 **Extensible** facilement pour de nouveaux besoins

Bon développement ! 🏕️
