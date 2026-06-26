# Design System Bivouac — Documentation finale

> Application : Bivouac — cartographie de spots de bivouac  
> Stack : Next.js · TypeScript · Tailwind CSS v4 · Lucide React  
> Dernière mise à jour : juin 2026

---

## Table des matières

1. [Principes & architecture](#1-principes--architecture)
2. [Installation & import](#2-installation--import)
3. [Tokens de design](#3-tokens-de-design)
4. [BivouacButton](#4-bivouacbutton)
5. [FilterChip](#5-filterchip)
6. [Card](#6-card)
7. [InfoCard](#7-infocard)
8. [AlertCard](#8-alertcard)
9. [SeasonBadge](#9-seasonbadge)
10. [CountBadge](#10-countbadge)
11. [StatusBadge](#11-statusbadge)
12. [Input](#12-input)
13. [Textarea](#13-textarea)
14. [Select](#14-select)
15. [Checkbox](#15-checkbox)
16. [RangeSlider](#16-rangeslider)
17. [DifficultySelector](#17-difficultyselector)
18. [Panel](#18-panel)
19. [PanelSection & PanelActions](#19-panelsection--panelactions)
20. [Guide d'adoption — nouveau projet Next.js](#20-guide-dadoption--nouveau-projet-nextjs)

---

## 1. Principes & architecture

### Philosophie

- **Un seul barrel** : tous les composants s'importent depuis `./ui/bivouac-ui`.
- **Tailwind en priorité** : aucune dépendance CSS externe. Tous les styles sont des classes Tailwind avec overrides via `cn()` (clsx + twMerge).
- **`className` toujours exposé** : chaque composant accepte un `className` pour surcharger les styles par défaut via twMerge. Les conflits (ex. `bg-white` vs `bg-blue-50`) sont résolus automatiquement — la valeur passée en `className` gagne toujours.
- **Logique zéro** : les composants DS ne gèrent pas d'état interne (sauf Panel qui gère son layout responsive). Toute la logique métier reste dans les composants applicatifs.

### Fichiers sources

```
src/app/components/ui/
├── bivouac-ui.tsx          ← barrel d'export (point d'entrée unique)
├── bivouac-button.tsx      ← BivouacButton, FilterChip
├── bivouac-card.tsx        ← Card, InfoCard, AlertCard
├── bivouac-badge.tsx       ← SeasonBadge, CountBadge, StatusBadge
├── bivouac-input.tsx       ← Input, Textarea, Select, Checkbox, RangeSlider, DifficultySelector
├── bivouac-panel.tsx       ← Panel, PanelSection, PanelActions
└── utils.ts                ← utilitaire cn()
```

### Utilitaire `cn()`

```ts
// src/app/components/ui/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Usage** : `cn('px-4 py-2', active && 'bg-emerald-600', className)`  
Grâce à twMerge, `cn('bg-white', 'bg-blue-50')` résout en `bg-blue-50` (la dernière valeur gagne).

---

## 2. Installation & import

### Import recommandé

```tsx
// Import depuis le barrel — à préférer dans tous les cas
import {
  BivouacButton,
  FilterChip,
  Card,
  InfoCard,
  AlertCard,
  SeasonBadge,
  CountBadge,
  StatusBadge,
  Input,
  Textarea,
  Select,
  Checkbox,
  RangeSlider,
  DifficultySelector,
  Panel,
  PanelSection,
  PanelActions,
} from './ui/bivouac-ui';
```

### Import direct (alternative)

```tsx
import { BivouacButton } from './ui/bivouac-button';
import { AlertCard } from './ui/bivouac-card';
```

---

## 3. Tokens de design

Les tokens sont définis dans `/src/styles/design-tokens.css` mais **non utilisés directement dans les composants** (tous les styles sont des classes Tailwind hardcodées). Ce fichier sert de référence sémantique.

| Token CSS | Valeur | Usage |
|-----------|--------|-------|
| `--color-primary` | `#059669` (emerald-600) | Actions principales, focus rings |
| `--color-primary-hover` | `#047857` (emerald-700) | Hover état primary |
| `--color-danger` | `#dc2626` (red-600) | Actions destructives |
| `--color-surface` | `#ffffff` | Fond des composants |
| `--color-border` | `#e5e7eb` (gray-200) | Bordures par défaut |
| `--panel-top-desktop` | `82px` | Position top du Panel en desktop |
| `--panel-width` | `480px` | Largeur du Panel en desktop |

### Palette fonctionnelle (Tailwind)

| Rôle | Couleur Tailwind | Exemple d'usage |
|------|-----------------|----------------|
| Action principale | `emerald-600` | BivouacButton primary |
| Danger / Suppression | `red-600` | BivouacButton destructive |
| Succès / Validation | `emerald-50/400/800` | AlertCard success |
| Avertissement doux | `orange-50/400/800` | AlertCard orange (zones réglementées) |
| Avertissement fort | `yellow-50/400/800` | AlertCard warning |
| Erreur | `red-50/400/800` | AlertCard error |
| Info | `blue-50/400/800` | AlertCard info |
| Neutre / Bordure | `gray-200` | Inputs, bordures |

---

## 4. BivouacButton

Bouton généraliste du design system. Supporte 5 variantes sémantiques et 3 tailles.

### Import

```tsx
import { BivouacButton } from './ui/bivouac-ui';
```

### Props

| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'outline' \| 'destructive' \| 'ghost'` | `'primary'` | Apparence sémantique |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Taille (padding + font) |
| `icon` | `React.ReactNode` | — | Icône Lucide affichée à gauche du texte |
| `disabled` | `boolean` | `false` | Désactive le bouton (opacity 50%) |
| `className` | `string` | — | Classes Tailwind supplémentaires (twMerge) |
| `...rest` | `ButtonHTMLAttributes` | — | Tous les attributs HTML natifs (`type`, `onClick`, etc.) |

### Variantes

| Variante | Fond | Texte | Hover | Usage |
|----------|------|-------|-------|-------|
| `primary` | `emerald-600` | blanc | `emerald-700` | Action principale |
| `secondary` | `white` + bordure `gray-200` | `gray-700` | `gray-50` | Action secondaire |
| `outline` | transparent + bordure `gray-200` | `gray-700` | `gray-50` | Action tertiaire |
| `destructive` | `red-600` | blanc | `red-700` | Suppression, déconnexion |
| `ghost` | transparent | `gray-600` | `gray-100` | Action contextuelle discrète |

### Tailles

| Taille | Padding | Font |
|--------|---------|------|
| `sm` | `px-3 py-1.5` | `text-sm` |
| `md` | `px-4 py-2` | `text-sm` |
| `lg` | `px-5 py-2.5` | `text-base` |

### Exemples

```tsx
// Action principale
<BivouacButton variant="primary" onClick={handleSave}>
  Enregistrer
</BivouacButton>

// Avec icône et taille large
<BivouacButton
  variant="primary"
  size="lg"
  icon={<LogIn size={18} />}
  disabled={isLoading}
  className="w-full"
>
  Se connecter
</BivouacButton>

// Destructif
<BivouacButton variant="destructive" icon={<Trash2 size={16} />}>
  Supprimer
</BivouacButton>

// Ghost pleine largeur (ex. reset filtres)
<BivouacButton
  variant="ghost"
  className="w-full bg-gray-100 hover:bg-gray-200 py-2.5"
>
  Réinitialiser les filtres
</BivouacButton>

// Surcharge couleur via className (twMerge résout le conflit bg)
<BivouacButton variant="primary" className="bg-sky-600 hover:bg-sky-700 w-full mt-4">
  J'ai compris
</BivouacButton>
```

### Contraintes

- Maximum **5 variantes** — ne pas en ajouter sans justification sémantique claire.
- Pour une couleur one-shot (ex. sky-600 dans WaterPointsInfo), utiliser `variant="primary"` avec override `className` plutôt que créer une nouvelle variante.
- Le composant rend une `<button>` HTML native — passer `type="submit"` dans les formulaires pour éviter le submit accidentel.

---

## 5. FilterChip

Bouton toggle de filtrage. Affiche un état actif/inactif avec une couleur sémantique configurable.

### Import

```tsx
import { FilterChip } from './ui/bivouac-ui';
```

### Props

| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `active` | `boolean` | requis | Détermine si le chip est sélectionné |
| `activeColor` | `string` | `'border-emerald-500 bg-emerald-50 text-emerald-800'` | Classes Tailwind pour l'état actif |
| `showCheckmark` | `boolean` | `true` | Affiche un petit indicateur circulaire quand actif |
| `children` | `React.ReactNode` | requis | Contenu du chip (texte + icône) |
| `className` | `string` | — | Classes supplémentaires (twMerge) |
| `...rest` | `ButtonHTMLAttributes` | — | Attributs HTML (`onClick`, `type`, etc.) |

### États visuels

| État | Style |
|------|-------|
| Inactif | `border-gray-200 bg-white text-gray-700 hover:bg-gray-50` |
| Actif | Défini par `activeColor` (ex. `border-emerald-500 bg-emerald-50 text-emerald-800`) |

### Exemples

```tsx
// Filtre saison (toute saison)
<FilterChip
  active={filters.seasons.includes('toute-saison')}
  onClick={() => toggleSeason('toute-saison')}
  activeColor="border-amber-500 bg-amber-50 text-amber-800"
>
  <SunSnow className="w-4 h-4" />
  Toute saison
</FilterChip>

// Filtre hiver
<FilterChip
  active={filters.seasons.includes('hiver')}
  onClick={() => toggleSeason('hiver')}
  activeColor="border-slate-500 bg-slate-50 text-slate-800"
>
  <Snowflake className="w-4 h-4" />
  Hiver
</FilterChip>

// Sans checkmark (ex. capacité dans formulaire de saisie)
<FilterChip
  type="button"
  active={season === 'toute-annee'}
  onClick={() => setSeason('toute-annee')}
  activeColor="border-amber-500 bg-amber-50 text-amber-700"
  showCheckmark={false}
  className="px-3 py-2"
>
  <SunSnow className="w-4 h-4" />
  Toute l'année
</FilterChip>

// Layout colonne (icône au-dessus du texte)
<FilterChip
  type="button"
  active={capacity === '1'}
  onClick={() => setCapacity('1')}
  activeColor="border-emerald-500 bg-emerald-50 text-emerald-800"
  showCheckmark={false}
  className="flex-col py-2 px-1"
>
  <Tent className="w-4 h-4" />
  <span className="text-xs">1</span>
</FilterChip>
```

### Contraintes

- Base flex `flex items-center justify-center` — en mode `flex-col`, `items-center` centre horizontalement.
- `flex-1` par défaut — dans un `flex gap-2`, les chips occupent la largeur disponible en parts égales. Pour des chips à largeur naturelle, surcharger avec `className="flex-none"`.
- `showCheckmark={false}` est recommandé pour les sélecteurs à icône seule (capacité, saison dans les formulaires de saisie).

---

## 6. Card

Conteneur de carte générique. Fond blanc, ombre portée, coins arrondis.

### Import

```tsx
import { Card } from './ui/bivouac-ui';
```

### Props

| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `children` | `React.ReactNode` | requis | Contenu de la carte |
| `className` | `string` | — | Surcharge Tailwind (twMerge) |
| `...rest` | `HTMLAttributes<div>` | — | Attributs HTML natifs |

### Style par défaut

`bg-white rounded-xl shadow-lg p-6`

### Exemples

```tsx
// Carte par défaut
<Card>
  <h2 className="text-xl font-bold">Titre</h2>
  <p className="text-gray-600">Contenu de la carte.</p>
</Card>

// Surcharge couleur et ombre (ex. carte d'info colorée)
<Card className="bg-blue-50 shadow-none p-3 rounded-lg">
  <h4 className="text-sm font-semibold text-blue-900">Comment ça marche ?</h4>
  <ul className="text-xs text-blue-800 mt-2 space-y-1">
    <li>• Élément 1</li>
  </ul>
</Card>
```

### Contraintes

- twMerge résout les conflits avec les overrides : `bg-blue-50` remplace `bg-white`, `shadow-none` remplace `shadow-lg`, etc.
- Pour les blocs d'alerte avec `border-l-4`, préférer `AlertCard` plutôt que surcharger `Card`.

---

## 7. InfoCard

Carte statistique compacte affichant un titre et une valeur numérique ou textuelle.

### Import

```tsx
import { InfoCard } from './ui/bivouac-ui';
```

### Props

| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `title` | `string` | requis | Libellé de la métrique |
| `value` | `string \| number` | requis | Valeur affichée en grand |
| `variant` | `'blue' \| 'emerald' \| 'orange' \| 'gray'` | `'blue'` | Couleur sémantique |
| `className` | `string` | — | Surcharge Tailwind |
| `...rest` | `HTMLAttributes<div>` | — | Attributs HTML natifs |

### Variantes

| Variante | Fond | Texte titre | Texte valeur |
|----------|------|-------------|-------------|
| `blue` | `blue-50` | `blue-600` | `blue-700` |
| `emerald` | `emerald-50` | `emerald-600` | `emerald-700` |
| `orange` | `orange-50` | `orange-600` | `orange-700` |
| `gray` | `gray-50` | `gray-600` | `gray-700` |

### Exemples

```tsx
// Stat itinéraire
<InfoCard title="Points d'itinéraire" value={routePointsCount} variant="blue" />
<InfoCard title="Spots à proximité" value={nearbyPoisCount} variant="emerald" />

// Avec layout côte à côte
<div className="grid grid-cols-2 gap-3">
  <InfoCard title="Distance totale" value="12.4 km" variant="blue" />
  <InfoCard title="Dénivelé +" value="840 m" variant="orange" />
</div>
```

### Contraintes

- La valeur est toujours affichée en `text-2xl font-bold` — pour des valeurs longues (ex. chaîne avec unité), envisager de passer `value="840 m"` comme string.
- Pas prévu pour contenir des sous-éléments complexes : utiliser `Card` dans ce cas.

---

## 8. AlertCard

Bloc d'alerte avec bordure gauche colorée. Pour les messages contextuels : succès, erreurs, avertissements, infos.

### Import

```tsx
import { AlertCard } from './ui/bivouac-ui';
```

### Props

| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `type` | `'success' \| 'warning' \| 'error' \| 'info' \| 'orange'` | requis | Sémantique de l'alerte |
| `children` | `React.ReactNode` | requis | Contenu libre |
| `className` | `string` | — | Surcharge Tailwind |
| `...rest` | `HTMLAttributes<div>` | — | Attributs HTML natifs |

### Variantes

| Type | Fond | Bordure gauche | Texte | Usage |
|------|------|---------------|-------|-------|
| `success` | `emerald-50` | `emerald-400` | `emerald-800` | Confirmation, validation |
| `warning` | `yellow-50` | `yellow-400` | `yellow-800` | Avertissement fort (safety) |
| `error` | `red-50` | `red-400` | `red-800` | Erreur bloquante |
| `info` | `blue-50` | `blue-400` | `blue-800` | Information contextuelle |
| `orange` | `orange-50` | `orange-400` | `orange-800` | Avertissement doux (zones réglementées) |

### Style de base

`border-l-4 p-3 rounded-r-lg` + couleurs du type

### Exemples

```tsx
// Succès (ex. itinéraire calculé)
<AlertCard type="success" className="mb-4">
  <p className="text-sm font-medium">Itinéraire calculé avec succès.</p>
</AlertCard>

// Erreur bloquante (zone interdite)
<AlertCard type="error" className="mb-3 border-red-500">
  <div className="flex items-start gap-2">
    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
    <div>
      <p className="text-sm font-semibold text-red-800">Bivouac interdit</p>
      <p className="text-xs text-red-700 mt-1">{reason}</p>
    </div>
  </div>
</AlertCard>

// Avertissement doux (zone réglementée)
<AlertCard type="orange" className="mb-4">
  <div className="flex items-start gap-2">
    <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
    <div>
      <h3 className="font-semibold text-orange-900 mb-1 text-sm">Réglementation</h3>
      <p className="text-sm text-orange-800">{location.regulations}</p>
    </div>
  </div>
</AlertCard>

// Info contextuelle
<AlertCard type="info">
  <p className="text-sm">Les données sont mises à jour toutes les 10 minutes.</p>
</AlertCard>
```

### Contraintes

- La structure interne est **libre** — AlertCard est un conteneur, pas un layout imposé.
- Pour renforcer visuellement la bordure gauche, passer `className="border-red-500"` (twMerge remplace `border-red-400` par `border-red-500`).
- Ne pas utiliser AlertCard pour des cartes arrondies sans `border-l-4` — utiliser `Card` dans ce cas.

---

## 9. SeasonBadge

Badge inline de saison. Affiche la saison d'un spot avec une couleur sémantique.

### Import

```tsx
import { SeasonBadge } from './ui/bivouac-ui';
import type { Season } from './ui/bivouac-ui';
```

### Props

| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `season` | `Season` | requis | Valeur de la saison |
| `icon` | `React.ReactNode` | — | Icône Lucide affichée à gauche |
| `className` | `string` | — | Surcharge Tailwind |

### Type `Season`

```ts
type Season = 'printemps' | 'été' | 'hiver' | 'toute saison';
```

### Variantes

| Saison | Fond | Texte |
|--------|------|-------|
| `printemps` | `emerald-100` | `emerald-800` |
| `été` | `orange-100` | `orange-800` |
| `hiver` | `slate-100` | `slate-800` |
| `toute saison` | `gray-100` | `gray-800` |

### Exemples

```tsx
import { SunSnow, Snowflake } from 'lucide-react';

<SeasonBadge season="toute saison" icon={<SunSnow className="w-3 h-3" />} />

<SeasonBadge season="hiver" icon={<Snowflake className="w-3 h-3" />} className="rounded-lg" />

// Dans une liste de tags
<div className="flex gap-2 flex-wrap">
  {spot.seasons.map(s => (
    <SeasonBadge key={s} season={s} />
  ))}
</div>
```

### Contraintes

- La valeur affichée est capitalisée automatiquement (`season.charAt(0).toUpperCase() + season.slice(1)`).
- Le type `Season` est strict — toute valeur hors de l'union provoque une erreur TypeScript.

---

## 10. CountBadge

Badge circulaire affichant un compteur numérique. Utilisé pour les filtres actifs, notifications légères.

### Import

```tsx
import { CountBadge } from './ui/bivouac-ui';
```

### Props

| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `count` | `number` | requis | Valeur à afficher |
| `className` | `string` | — | Surcharge Tailwind |

### Style par défaut

`bg-emerald-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-md`

### Exemples

```tsx
// Badge de filtre dans une barre de recherche (taille réduite)
<div className="relative">
  <button onClick={onFilterClick}>
    <SlidersHorizontal className="w-5 h-5" />
    Filtres
  </button>
  {activeFiltersCount > 0 && (
    <CountBadge count={activeFiltersCount} className="absolute -top-1 -right-1 w-4 h-4" />
  )}
</div>

// Badge standard (5×5)
<CountBadge count={3} />
```

### Contraintes

- Taille par défaut `w-5 h-5` — pour les petits contextes (barre de recherche), passer `className="w-4 h-4"`.
- Ne pas dépasser 2 chiffres visuellement (le cercle ne s'adapte pas).

---

## 11. StatusBadge

Badge inline généraliste pour des statuts sémantiques libres (succès, avertissement, erreur, info).

### Import

```tsx
import { StatusBadge } from './ui/bivouac-ui';
```

### Props

| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `status` | `'success' \| 'warning' \| 'error' \| 'info'` | requis | Couleur sémantique |
| `children` | `React.ReactNode` | requis | Texte ou contenu du badge |
| `className` | `string` | — | Surcharge Tailwind |

### Variantes

| Status | Fond | Texte |
|--------|------|-------|
| `success` | `emerald-100` | `emerald-800` |
| `warning` | `yellow-100` | `yellow-800` |
| `error` | `red-100` | `red-800` |
| `info` | `blue-100` | `blue-800` |

### Exemples

```tsx
<StatusBadge status="success">Validé</StatusBadge>
<StatusBadge status="warning">En attente</StatusBadge>
<StatusBadge status="error">Bloqué</StatusBadge>

// Avec icône
<StatusBadge status="info">
  <Info className="w-3 h-3" />
  Beta
</StatusBadge>
```

### Contraintes

- Différence avec `SeasonBadge` : StatusBadge a un contenu libre (`children`) et est sémantiquement généraliste. `SeasonBadge` est typé sur les saisons de l'app.
- Différence avec `AlertCard` : StatusBadge est inline dans du texte, AlertCard est un bloc structurant.

---

## 12. Input

Champ de saisie texte avec label optionnel et état d'erreur.

### Import

```tsx
import { Input } from './ui/bivouac-ui';
```

### Props

| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `label` | `string` | — | Label affiché au-dessus (optionnel) |
| `error` | `string` | — | Message d'erreur affiché en dessous |
| `className` | `string` | — | Surcharge du `<input>` (twMerge) |
| `...rest` | `InputHTMLAttributes` | — | Tous les attributs HTML (`type`, `value`, `onChange`, `disabled`, `placeholder`, `autoComplete`, etc.) |

### Style par défaut du `<input>`

`w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all bg-white`

### Exemples

```tsx
// Champ simple avec label
<Input
  label="Email"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  placeholder="exemple@domaine.fr"
  autoComplete="email"
/>

// Avec état d'erreur
<Input
  label="Nom de la zone *"
  value={name}
  onChange={(e) => setName(e.target.value)}
  error={nameError}
/>

// Taille compacte dans une barre d'outils
<Input
  type="url"
  value={newPhotoUrl}
  onChange={(e) => setNewPhotoUrl(e.target.value)}
  placeholder="URL de la photo"
  className="text-sm px-3 py-2"
/>

// Champ de connexion avec padding vertical ajusté
<Input
  label="Mot de passe"
  type="password"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
  className="py-2.5"
  autoComplete="current-password"
/>
```

### Contraintes

- `className` est appliqué sur le `<input>` natif, pas sur le wrapper `<div>`. Pour styler le wrapper, envelopper dans un `<div>`.
- En cas d'erreur (`error` renseigné), la bordure passe en `border-red-300` et le focus ring en `focus:ring-red-500`.
- `label` est un `string` — pour les labels avec éléments HTML (`*` en rouge, etc.), utiliser un `<label>` externe et passer `label={undefined}`.

---

## 13. Textarea

Zone de texte multiligne avec label optionnel et état d'erreur.

### Import

```tsx
import { Textarea } from './ui/bivouac-ui';
```

### Props

| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `label` | `string` | — | Label affiché au-dessus |
| `error` | `string` | — | Message d'erreur |
| `className` | `string` | — | Surcharge du `<textarea>` (twMerge) |
| `...rest` | `TextareaHTMLAttributes` | — | `rows`, `value`, `onChange`, `placeholder`, `disabled`, etc. |

### Style par défaut

Identique à Input + `resize-none`.

### Exemples

```tsx
// Description de spot
<Textarea
  label="Description *"
  value={description}
  onChange={(e) => setDescription(e.target.value)}
  placeholder="Décrivez le lieu, l'accès, les particularités…"
  rows={3}
/>

// Champ commentaire avec thème amber (surcharge focus ring)
<Textarea
  className="text-sm rounded-md border-amber-200 px-3 focus:ring-1 focus:ring-amber-400 text-gray-700"
  rows={2}
  placeholder="Décrivez votre expérience…"
  value={reviewComment}
  onChange={(e) => setReviewComment(e.target.value)}
/>

// Réglementation (focus ring orange)
<Textarea
  value={regulationDetails}
  onChange={(e) => setRegulationDetails(e.target.value)}
  placeholder="Autres restrictions…"
  rows={2}
  className="text-sm px-3 py-2 focus:ring-orange-500"
/>
```

### Contraintes

- `resize-none` est activé par défaut — pour permettre le redimensionnement, passer `className="resize-y"`.
- Mêmes règles que `Input` pour `className` (appliqué sur `<textarea>`, pas le wrapper).

---

## 14. Select

Menu déroulant avec label optionnel et liste d'options typées.

### Import

```tsx
import { Select } from './ui/bivouac-ui';
```

### Props

| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `label` | `string` | — | Label affiché au-dessus |
| `options` | `Array<{ value: string; label: string }>` | requis | Liste des options |
| `error` | `string` | — | Message d'erreur |
| `className` | `string` | — | Surcharge du `<select>` |
| `...rest` | `SelectHTMLAttributes` | — | `value`, `onChange`, `disabled`, etc. |

### Exemples

```tsx
<Select
  label="Type de restriction"
  value={restrictionType}
  onChange={(e) => setRestrictionType(e.target.value)}
  options={[
    { value: 'forbidden', label: 'Interdit' },
    { value: 'regulated', label: 'Réglementé' },
    { value: 'allowed', label: 'Autorisé' },
  ]}
/>
```

---

## 15. Checkbox

Case à cocher avec label intégré.

### Import

```tsx
import { Checkbox } from './ui/bivouac-ui';
```

### Props

| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `label` | `string` | requis | Texte affiché à droite de la case |
| `className` | `string` | — | Surcharge du `<input type="checkbox">` |
| `...rest` | `InputHTMLAttributes<checkbox>` | — | `checked`, `onChange`, `disabled`, etc. |

### Exemples

```tsx
<Checkbox
  label="Activer les notifications"
  checked={notificationsEnabled}
  onChange={(e) => setNotificationsEnabled(e.target.checked)}
/>

<Checkbox
  label="Parc national — bivouac 19h à 9h"
  checked={isNationalPark}
  onChange={(e) => setIsNationalPark(e.target.checked)}
  disabled={isLoading}
/>
```

### Contraintes

- `label` est un `string` obligatoire. Pour les labels avec layout complexe (icône + sous-titre), utiliser un `<label>` HTML natif.
- La case mesure `w-5 h-5` avec couleur `emerald-600`.

---

## 16. RangeSlider

Curseur de plage avec affichage de la valeur courante.

### Import

```tsx
import { RangeSlider } from './ui/bivouac-ui';
```

### Props

| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `label` | `string` | — | Label affiché au-dessus |
| `unit` | `string` | — | Unité affichée après la valeur (ex. `"km"`) |
| `displayValue` | `string \| number` | — | Valeur affichée à droite (si différente de `value`) |
| `value` | `string \| number` | — | Valeur courante |
| `className` | `string` | — | Surcharge du `<input type="range">` |
| `...rest` | `InputHTMLAttributes<range>` | — | `min`, `max`, `step`, `onChange`, etc. |

### Exemples

```tsx
<RangeSlider
  label="Distance maximale"
  min={0.5}
  max={10}
  step={0.5}
  value={maxDistance}
  onChange={(e) => setMaxDistance(parseFloat(e.target.value))}
  unit="km"
  displayValue={maxDistance}
/>
```

### Contraintes

- La valeur affichée est dans un `<span className="w-16 text-right">` — pour des valeurs longues (ex. `"> 10 km"`), passer `displayValue` comme string formaté.
- La couleur d'accent du curseur est `emerald-600` via `accent-emerald-600`.

---

## 17. DifficultySelector

Sélecteur de niveaux de difficulté 0–5 avec coloration sémantique par plage.

### Import

```tsx
import { DifficultySelector } from './ui/bivouac-ui';
```

### Props

| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `selectedLevels` | `number[]` | requis | Niveaux actuellement sélectionnés |
| `onToggle` | `(level: number) => void` | requis | Callback de toggle d'un niveau |
| `className` | `string` | — | Surcharge du conteneur flex |

### Coloration par niveau

| Niveau | Couleur active |
|--------|---------------|
| 0 | `border-gray-500 bg-gray-100 text-gray-700` |
| 1–2 | `border-green-500 bg-green-50 text-green-700` |
| 3 | `border-yellow-500 bg-yellow-50 text-yellow-700` |
| 4–5 | `border-red-500 bg-red-50 text-red-700` |

### Exemples

```tsx
// Sélection multiple (filtre)
<DifficultySelector
  selectedLevels={filters.difficulties}
  onToggle={(level) => {
    const newDiffs = filters.difficulties.includes(level)
      ? filters.difficulties.filter(d => d !== level)
      : [...filters.difficulties, level];
    onFilterChange({ ...filters, difficulties: newDiffs });
  }}
/>

// Sélection unique (formulaire de saisie)
<DifficultySelector
  selectedLevels={[difficulty]}
  onToggle={(level) => setDifficulty(level)}
/>
```

### Contraintes

- Rend toujours les 6 niveaux (0 à 5) dans un `flex gap-1.5`.
- Chaque bouton a `type="button"` pour ne pas soumettre les formulaires parents.

---

## 18. Panel

Composant de panneau latéral **responsive** : bottom-sheet sur mobile, sidebar sur desktop.

### Import

```tsx
import { Panel } from './ui/bivouac-ui';
```

### Props

| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `onClose` | `() => void` | requis | Callback de fermeture |
| `title` | `string` | requis | Titre du panneau |
| `icon` | `React.ReactNode` | — | Icône affichée avant le titre |
| `children` | `React.ReactNode` | requis | Contenu scrollable |
| `className` | `string` | — | Surcharge des deux conteneurs (mobile + desktop) |
| `mobileMaxHeight` | `string` | `'calc(100vh - 120px)'` | Hauteur max du bottom-sheet mobile |
| `stickyFooter` | `React.ReactNode` | — | Footer fixe en bas du panneau |

### Layout responsive

| Breakpoint | Layout | Position | Z-index |
|------------|--------|----------|---------|
| Mobile (`< md`) | Bottom sheet, coin arrondis en haut | `fixed inset-x-0 bottom-0` | `z-[1000]` |
| Desktop (`≥ md`) | Sidebar gauche | `fixed top-[82px] left-6 w-[480px]` | `z-[500]` |

### Structure interne

```
Panel
├── Header (drag handle + titre + bouton ×)
│   └── icon? + title
├── Scrollable content (children)
└── stickyFooter? (border-t, fond blanc)
```

### Exemples

```tsx
// Panneau simple
<Panel onClose={handleClose} title="Filtres">
  <FilterSection />
</Panel>

// Avec icône
<Panel
  onClose={handleClose}
  title="Ajouter un spot"
  icon={<MapPin className="w-5 h-5" />}
>
  <AddSpotForm />
</Panel>

// Avec footer sticky (ex. bouton de soumission toujours visible)
<Panel
  onClose={handleClose}
  title="Créer une zone"
  stickyFooter={
    <BivouacButton variant="primary" className="w-full" type="submit">
      Enregistrer
    </BivouacButton>
  }
>
  <ZoneForm />
</Panel>

// Hauteur mobile personnalisée
<Panel
  onClose={handleClose}
  title="Détails"
  mobileMaxHeight="calc(100vh - 80px)"
>
  <DetailsContent />
</Panel>
```

### Contraintes

- **Ne jamais recréer le dual-layout manuellement** (bottom-sheet + sidebar) — utiliser Panel.
- `top-[82px]` est la position desktop correcte (hauteur de la SearchBar). Ne pas utiliser `top-[158px]` (valeur stale d'une version précédente).
- Le contenu est scrollable dans `flex-1 overflow-y-auto`. Pas besoin d'ajouter de scroll custom.
- `className` est appliqué aux deux divs (mobile et desktop) via `cn()` — pour styler uniquement l'un des deux, imbriquer dans un wrapper conditionnel.
- Z-index du bottom-sheet mobile (`z-[1000]`) > Z-index desktop sidebar (`z-[500]`) — cohérent avec la SearchBar en `z-[600]`.

---

## 19. PanelSection & PanelActions

Composants de structuration interne d'un Panel.

### Import

```tsx
import { PanelSection, PanelActions } from './ui/bivouac-ui';
```

### PanelSection

Ajoute un `mb-4` pour séparer les sections de contenu.

```tsx
<PanelSection>
  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Saison</h3>
  {/* ... */}
</PanelSection>

<PanelSection className="mb-6">
  {/* section avec espacement plus grand */}
</PanelSection>
```

### PanelActions

Conteneur flex pour les boutons d'action en bas de panneau.

```tsx
<PanelActions>
  <BivouacButton variant="outline" onClick={handleCancel} className="flex-1">
    Annuler
  </BivouacButton>
  <BivouacButton variant="primary" type="submit" className="flex-1">
    Enregistrer
  </BivouacButton>
</PanelActions>
```

---

## 20. Guide d'adoption — nouveau projet Next.js

Ce guide décrit comment intégrer le design system Bivouac dans un nouveau projet Next.js (ex. site vitrine institutionnel).

### 20.1 Prérequis

```bash
# Stack minimale
npm install tailwindcss clsx tailwind-merge lucide-react
```

Versions validées :
- Tailwind CSS v4+
- clsx ^2.x
- tailwind-merge ^2.x
- lucide-react ^0.400+

### 20.2 Copier les fichiers sources

```
src/
└── components/
    └── ui/
        ├── utils.ts               ← cn() utilitaire
        ├── bivouac-button.tsx
        ├── bivouac-card.tsx
        ├── bivouac-badge.tsx
        ├── bivouac-input.tsx
        ├── bivouac-panel.tsx
        └── bivouac-ui.tsx         ← barrel d'export
```

### 20.3 Configurer l'alias d'import (optionnel)

Dans `tsconfig.json` :

```json
{
  "compilerOptions": {
    "paths": {
      "@/components/*": ["./src/components/*"]
    }
  }
}
```

Permet d'importer depuis n'importe où :

```tsx
import { BivouacButton, Panel } from '@/components/ui/bivouac-ui';
```

### 20.4 Copier les design tokens (optionnel)

```css
/* src/styles/design-tokens.css */
:root {
  --color-primary: #059669;
  --color-primary-hover: #047857;
  --color-danger: #dc2626;
  --color-surface: #ffffff;
  --color-border: #e5e7eb;
  --panel-top-desktop: 82px;
  --panel-width: 480px;
}
```

Importer dans le CSS global :

```css
/* src/app/globals.css */
@import './design-tokens.css';
```

> Note : les composants n'utilisent pas ces variables CSS — ils utilisent des classes Tailwind. Le fichier sert de référence documentaire.

### 20.5 Premier composant

```tsx
// src/app/page.tsx
import { BivouacButton, AlertCard } from '@/components/ui/bivouac-ui';

export default function HomePage() {
  return (
    <main className="p-8 max-w-xl mx-auto">
      <AlertCard type="info" className="mb-6">
        <p className="text-sm">Bienvenue sur le site Bivouac.</p>
      </AlertCard>

      <BivouacButton variant="primary" size="lg" className="w-full">
        Découvrir les spots
      </BivouacButton>
    </main>
  );
}
```

### 20.6 Adapter Panel à un site vitrine

Le composant `Panel` est conçu pour une app cartographique (bottom-sheet mobile / sidebar desktop `top-82px`). Pour un site vitrine, deux adaptations courantes :

**Option A — Drawer latéral (menu mobile)**

```tsx
<Panel
  onClose={() => setMenuOpen(false)}
  title="Menu"
  className="md:hidden" // uniquement mobile
>
  <nav>
    <a href="/">Accueil</a>
    <a href="/contact">Contact</a>
  </nav>
</Panel>
```

**Option B — Modal / Aside repositionné**

```tsx
// Surcharger la position desktop via className
<Panel
  onClose={handleClose}
  title="Détails du projet"
  className="md:top-0 md:left-auto md:right-0 md:h-screen md:rounded-none"
>
  {/* contenu */}
</Panel>
```

### 20.7 Checklist d'adoption

- [ ] `utils.ts` copié et fonctionnel (`cn()` retourne les classes correctement)
- [ ] Les 5 fichiers `bivouac-*.tsx` copiés sans erreur TypeScript
- [ ] `bivouac-ui.tsx` barrel d'export fonctionnel
- [ ] Un `BivouacButton` affiché sans erreur de build
- [ ] `cn()` résout correctement les conflits (`className` override gagne)
- [ ] `Panel` responsive testé mobile + desktop
- [ ] `AlertCard` affiché dans les 5 types
- [ ] `Input` / `Textarea` soumettent correctement dans un formulaire

### 20.8 Ce que le DS ne couvre pas (intentionnellement)

| Besoin | Solution suggérée |
|--------|------------------|
| Navigation / Header | Composant custom (hors scope DS) |
| Table de données | shadcn/ui `<Table>` ou TanStack Table |
| Modal / Dialog | shadcn/ui `<Dialog>` |
| Toast / Notification | sonner, react-hot-toast |
| Carousel | embla-carousel |
| Date picker | react-day-picker |
| Charts / Graphiques | recharts (déjà présent dans le projet) |

---

*Design System Bivouac — consolidé en Phase 2, documenté en Phase 3.*  
*17 composants · 1 barrel d'export · Stack : Next.js + Tailwind CSS v4 + TypeScript*
