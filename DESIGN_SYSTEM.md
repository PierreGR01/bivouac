# 🏕️ Design System - Application Bivouac

## Table des matières
1. [Palette de couleurs](#palette-de-couleurs)
2. [Typographie](#typographie)
3. [Espacements](#espacements)
4. [Composants](#composants)
5. [Patterns](#patterns)
6. [Iconographie](#iconographie)

---

## Palette de couleurs

### Couleurs sémantiques par saison

#### Printemps / Toute saison
- **Primary**: `#10b981` (emerald-600)
- **Hover**: `#059669` (emerald-700)
- **Light**: `#d1fae5` (emerald-100)
- **Usage**: Points par défaut, actions principales

#### Hiver
- **Primary**: `#64748b` (slate-500)
- **Hover**: `#475569` (slate-600)
- **Light**: `#e2e8f0` (slate-200)
- **Usage**: Points d'hiver, indicateurs froids

#### Été
- **Primary**: `#ea580c` (orange-600)
- **Hover**: `#c2410c` (orange-700)
- **Light**: `#fed7aa` (orange-200)
- **Usage**: Points d'été, indicateurs chauds

### Couleurs fonctionnelles

#### Navigation & Itinéraires
- **Route**: `#2563eb` (blue-600)
- **Route Hover**: `#1d4ed8` (blue-700)
- **Route Light**: `#dbeafe` (blue-100)

#### États & Feedback
- **Success**: `#10b981` (emerald-600)
- **Warning**: `#f59e0b` (amber-500)
- **Error**: `#ef4444` (red-500)
- **Info**: `#3b82f6` (blue-500)

#### Neutrals
- **White**: `#ffffff`
- **Gray 50**: `#f9fafb`
- **Gray 100**: `#f3f4f6`
- **Gray 200**: `#e5e7eb`
- **Gray 300**: `#d1d5db`
- **Gray 600**: `#4b5563`
- **Gray 700**: `#374151`
- **Gray 800**: `#1f2937`
- **Gray 900**: `#111827`
- **Black**: `#000000`

---

## Typographie

### Tailles
- **text-xs**: 0.75rem (12px)
- **text-sm**: 0.875rem (14px)
- **text-base**: 1rem (16px)
- **text-lg**: 1.125rem (18px)
- **text-xl**: 1.25rem (20px)
- **text-2xl**: 1.5rem (24px)

### Poids
- **normal**: 400
- **medium**: 500
- **semibold**: 600
- **bold**: 700

### Hiérarchie
```css
h1: text-2xl, font-medium
h2: text-xl, font-medium
h3: text-lg, font-medium
h4: text-base, font-medium
body: text-base, font-normal
caption: text-sm, font-normal
small: text-xs, font-normal
```

---

## Espacements

### Scale
- **0**: 0px
- **1**: 2px
- **2**: 4px
- **3**: 8px
- **4**: 12px
- **5**: 16px
- **6**: 24px
- **8**: 32px
- **10**: 40px
- **12**: 48px

### Marges entre composants
- **Panneau inter-éléments**: 16px (gap-4)
- **Sections**: 24px (gap-6)
- **Cards**: 12px (gap-3)
- **Inline**: 8px (gap-2)
- **Panneau-carte**: 2px (espacement minimal)

---

## Composants

### Boutons

#### Primary (Action principale)
```tsx
className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors shadow-md"
```

#### Secondary (Route/Navigation)
```tsx
className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md"
```

#### Outline (Actions secondaires)
```tsx
className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
```

#### Destructive
```tsx
className="px-4 py-2 border-2 border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
```

#### Ghost (Fermeture)
```tsx
className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
```

### Inputs

#### Text Input
```tsx
className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
```

#### Textarea
```tsx
className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
```

#### Select
```tsx
className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
```

#### Checkbox
```tsx
className="w-5 h-5 text-emerald-600 rounded focus:ring-2 focus:ring-emerald-500"
```

#### Range Slider
```tsx
className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
```

### Cards

#### POI Card (Détails)
```tsx
className="bg-white rounded-xl shadow-lg p-6"
```

#### Info Card (Statistiques)
```tsx
className="bg-blue-50 rounded-lg p-3"
```

#### Alert Card
```tsx
// Success
className="bg-emerald-50 border-l-4 border-emerald-400 p-3 rounded-r-lg"

// Warning
className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded-r-lg"

// Error
className="bg-red-50 border-l-4 border-red-400 p-3 rounded-r-lg"
```

### Badges

#### Saison Badge
```tsx
// Printemps
className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-800 text-xs font-medium rounded-full"

// Été
className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded-full"

// Hiver
className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-800 text-xs font-medium rounded-full"

// Toute saison
className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full"
```

#### Filtre actif Badge
```tsx
className="bg-emerald-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-md"
```

### Marqueurs (Leaflet)

#### POI Marker - Printemps
```css
.custom-marker {
  background-color: #10b981;
  border: 3px solid white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
```

#### POI Marker - Hiver
```css
.custom-marker-winter {
  background-color: #64748b;
  border: 3px solid white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  box-shadow: 0 2px 8px rgba(100, 116, 139, 0.4);
}
```

#### POI Marker - Été
```css
.custom-marker-summer {
  background-color: #ea580c;
  border: 3px solid white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  box-shadow: 0 2px 8px rgba(234, 88, 12, 0.4);
}
```

#### Temporary Marker
```css
.temporary-marker {
  background-color: #f59e0b;
  border: 4px solid white;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.5);
  animation: pulse 2s ease-in-out infinite;
}
```

---

## Patterns

### Panel Layout

#### Desktop Panel
```tsx
className="hidden md:block fixed top-[158px] left-6 w-[480px] bg-white/70 backdrop-blur-md border border-white/30 shadow-2xl z-[500] rounded-b-xl"
```

#### Mobile Panel
```tsx
className="md:hidden fixed inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl z-[1000]"
```

### Search Bar

#### Container Desktop
```tsx
className="hidden md:block fixed top-6 left-6 w-[480px] z-[600]"
```

#### Container Mobile
```tsx
className="md:hidden fixed top-6 left-6 right-6 z-[600]"
```

#### Background
```tsx
className="bg-white/70 backdrop-blur-md border border-white/30 shadow-2xl p-4 rounded-xl"
```

### Animations

#### Slide Up (Mobile)
```css
@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
animation: slideUp 0.3s ease-out
```

#### Fade In
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
animation: fadeIn 0.3s ease-out
```

#### Pulse (Temporary Marker)
```css
@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.2); opacity: 0.8; }
}
animation: pulse 2s ease-in-out infinite
```

### Z-Index Scale
- **Map**: 0
- **Panels**: 500
- **Search Bar**: 600
- **Mobile Bottom Panel**: 1000
- **Modal Overlay**: 1100

---

## Iconographie

### Lucide Icons utilisées

#### Navigation & Actions
- `Search` - Recherche
- `SlidersHorizontal` - Filtres
- `Plus` - Ajouter
- `Route` - Itinéraire
- `X` - Fermer
- `Check` - Confirmer
- `Trash2` - Supprimer

#### POI & Localisation
- `Tent` - Bivouac
- `MapPin` - Localisation
- `Droplet` - Point d'eau
- `AlertTriangle` - Réglementation

#### Saisons
- `Leaf` - Printemps
- `Sun` - Été
- `Snowflake` - Hiver
- `Calendar` - Toute saison

#### Utilitaires
- `Zap` - Mode intelligent
- `Loader2` - Chargement (animate-spin)
- `AlertCircle` - Information
- `Settings` - Configuration

### Tailles des icônes
- **Small**: `w-4 h-4` (16px)
- **Default**: `w-5 h-5` (20px)
- **Large**: `w-6 h-6` (24px)
- **XLarge**: `w-8 h-8` (32px)

---

## Responsivité

### Breakpoints
```css
sm: 640px   /* Rarement utilisé */
md: 768px   /* Desktop vs Mobile */
lg: 1024px  /* Grands écrans */
xl: 1280px  /* Très grands écrans */
```

### Stratégie Mobile-First
- Panel latéral (desktop) → Panel bas (mobile)
- Largeur fixe 480px (desktop) → Full width (mobile)
- Positionnement `top-[158px]` (desktop) → `bottom-0` (mobile)

### Particularités
- **Espacement panneau-carte**: 2px constant
- **Largeur max panneau**: 480px
- **Border radius conditionnels**: Selon l'état des panneaux ouverts
- **Backdrop blur**: Utilisé pour améliorer la lisibilité sur la carte

---

## Accessibilité

### Contraste
- Texte principal: Ratio 7:1 minimum
- Texte secondaire: Ratio 4.5:1 minimum
- Boutons: Couleurs distinctes avec bordures

### Focus States
- Ring: `focus:ring-2 focus:ring-emerald-500`
- Outline: `focus:outline-none` (avec ring custom)

### States interactifs
- `hover:` - États de survol
- `disabled:opacity-50 disabled:cursor-not-allowed` - États désactivés
- `transition-colors` - Transitions fluides

---

## Exemples d'utilisation

### Bouton d'action principal
```tsx
<button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors shadow-md">
  <Plus className="w-5 h-5" />
  <span>Ajouter un spot</span>
</button>
```

### Card statistique
```tsx
<div className="bg-blue-50 rounded-lg p-3">
  <p className="text-xs text-blue-600 font-medium mb-1">Points d'itinéraire</p>
  <p className="text-2xl font-bold text-blue-700">5</p>
</div>
```

### Badge de saison
```tsx
<span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-800 text-xs font-medium rounded-full">
  <Leaf className="w-3 h-3" />
  Printemps
</span>
```

### Input de formulaire
```tsx
<input
  type="text"
  placeholder="Titre du spot..."
  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
/>
```

---

## Notes de mise en œuvre

### CSS Variables utilisées
Définies dans `/src/styles/theme.css` :
- Couleurs avec support dark mode
- Radius variables (`--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`)
- Font weights (`--font-weight-medium`, `--font-weight-normal`)

### Tailwind CSS v4
- Utilisation de classes inline
- Pas de `tailwind.config.js`
- Tokens définis dans `theme.css`

### Performance
- Backdrop blur utilisé avec parcimonie
- Animations limitées aux éléments essentiels
- Shadow utilisée pour la hiérarchie visuelle
