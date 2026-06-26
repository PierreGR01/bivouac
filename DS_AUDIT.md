# DS_AUDIT.md — Audit complet du Design System Bivouac

> Généré le 2026-06-26 · Analysé depuis `src/`

---

## Sommaire

1. [Inventaire des composants](#1-inventaire-des-composants)
2. [Composants bivouac-* (Design System officiel)](#2-composants-bivouac--design-system-officiel)
3. [Composants applicatifs hors DS](#3-composants-applicatifs-hors-ds)
4. [Patterns visuels récurrents non encapsulés](#4-patterns-visuels-récurrents-non-encapsulés)
5. [Divergences documentation vs code réel](#5-divergences-documentation-vs-code-réel)
6. [Tokens CSS : utilisés vs inutilisés](#6-tokens-css--utilisés-vs-inutilisés)
7. [Récapitulatif des actions Phase 2](#7-récapitulatif-des-actions-phase-2)

---

## 1. Inventaire des composants

### 1.1 Composants du Design System officiel (`/src/app/components/ui/bivouac-*.tsx`)

| Fichier | Composants exportés | Utilisé dans l'app |
|---|---|---|
| `bivouac-button.tsx` | `BivouacButton` | ✅ Oui (6 composants) |
| `bivouac-card.tsx` | `Card`, `InfoCard`, `AlertCard` | ❌ Non |
| `bivouac-badge.tsx` | `SeasonBadge`, `CountBadge`, `StatusBadge` | ❌ Non |
| `bivouac-input.tsx` | `Input`, `Textarea`, `Select`, `Checkbox`, `RangeSlider` | ❌ Non |
| `bivouac-panel.tsx` | `Panel`, `PanelSection`, `PanelActions` | ✅ Oui (6 composants) |
| `bivouac-ui.tsx` | Export centralisé | — |

### 1.2 Composants applicatifs (`/src/app/components/*.tsx`)

| Fichier | Rôle | Utilise Panel | Utilise BivouacButton |
|---|---|---|---|
| `SearchBar.tsx` | Barre recherche + dropdown + actions | ❌ | ❌ |
| `FilterPanel.tsx` | Filtres POI | ✅ | ❌ |
| `AddPoiPanel.tsx` | Formulaire ajout spot | ✅ | ✅ |
| `PoiDetailsPanel.tsx` | Détails d'un spot | ✅ | ✅ |
| `ZoneInfoPanel.tsx` | Infos zone réglementée | ✅ | ❌ |
| `LoginPanel.tsx` | Authentification admin | ✅ | ✅ |
| `RoutePanel.tsx` | Panneau itinéraire | ✅ | ✅ |
| `CustomZonesEditor.tsx` | Outil admin dessin zones | ❌ réimplémenté | ✅ (via CustomZoneForm) |
| `CustomZoneForm.tsx` | Formulaire édition zone | panel flottant custom | ✅ |
| `MapControls.tsx` | Boutons carte (zoom, calques…) | ❌ | ❌ |
| `WaterPointsInfo.tsx` | Modal info points d'eau | ❌ modal custom | ❌ |
| `figma/ImageWithFallback.tsx` | Image avec fallback | ❌ | ❌ |

### 1.3 Composants shadcn/ui présents mais non utilisés activement

Plus de 35 fichiers shadcn dans `/src/app/components/ui/` (accordion, alert-dialog, avatar, badge, button, card, chart, checkbox, dialog, dropdown-menu, etc.). Ces composants sont générés par shadcn/ui et ne font pas partie du DS Bivouac. Ils ne sont pas utilisés dans l'app et ne nécessitent pas d'intégration au DS.

---

## 2. Composants bivouac-* (Design System officiel)

### 2.1 BivouacButton

**Fichier** : `bivouac-button.tsx`

**Variants** :
| Variant | Classes Tailwind | Couleur |
|---|---|---|
| `primary` | `bg-emerald-600 text-white hover:bg-emerald-700` | Vert émeraude |
| `secondary` | `bg-white border border-gray-200 text-gray-700 hover:bg-gray-50` | Blanc/gris |
| `outline` | `border border-gray-200 text-gray-700 hover:bg-gray-50` | Transparent/gris |
| `destructive` | `bg-red-600 text-white hover:bg-red-700` | Rouge |
| `ghost` | `text-gray-600 hover:bg-gray-100` | Sans fond |

**Props** : `variant`, `size` (sm/md/lg), `icon`, `disabled`, + tous `ButtonHTMLAttributes`

**Usages dans l'app** :
- `AddPoiPanel` : variants primary, outline
- `PoiDetailsPanel` : variants destructive, outline, primary (size sm)
- `LoginPanel` : variants primary, destructive (size lg)
- `RoutePanel` : variants destructive, primary
- `CustomZoneForm` : variants primary, destructive, outline
- `CustomZonesEditor` : via CustomZoneForm

**Problèmes** :
- `secondary` et `outline` sont visuellement quasi-identiques (`secondary` ajoute juste `bg-white` explicite)
- Le variant `destructive` est utilisé avec un override de classes dans PoiDetailsPanel (`bg-red-50 text-red-700 border border-red-200 hover:bg-red-100`), cassant la sémantique du variant

---

### 2.2 Card / InfoCard / AlertCard

**Fichier** : `bivouac-card.tsx`

**BILAN : Ces composants ne sont JAMAIS importés dans l'app.** Ils sont définis mais entièrement ignorés au profit d'implémentations inline.

**Card** : `bg-white rounded-xl shadow-lg p-6`

**InfoCard** : stat avec title xs + value 2xl. Variants : `blue`, `emerald`, `orange`, `gray`

**AlertCard** : bandeau avec bordure gauche colorée. Types : `success`, `warning`, `error`, `info`

**Usages attendus mais manquants** :
- `InfoCard` → `RoutePanel` (2 divs inline identiques lignes 45–53)
- `AlertCard type="info"` → `RoutePanel` (instructions lignes 36–41)
- `AlertCard type="error/warning"` → `AddPoiPanel` (4 blocs inline identiques lignes 200–269)
- `AlertCard` → `LoginPanel` (erreur ligne 96)
- `AlertCard` → `PoiDetailsPanel` (6+ blocs inline lignes 492–628)

---

### 2.3 SeasonBadge / CountBadge / StatusBadge

**Fichier** : `bivouac-badge.tsx`

**BILAN : Ces composants ne sont JAMAIS importés dans l'app.**

**SeasonBadge** : `printemps` / `été` / `hiver` / `toute saison` en rounded-full pill

**CountBadge** : nombre dans cercle émeraude (w-5 h-5)

**StatusBadge** : pill avec variants success/warning/error/info

**Usages attendus mais manquants** :
- `SeasonBadge` → `PoiDetailsPanel` (badge saison lignes 368–371, avec implémentation inline `getSeasonStyle/getSeasonLabel/getSeasonIcon`)
- `CountBadge` → `SearchBar` (badge filtre actif, lignes 278, 393 — mais w-4 h-4 alors que CountBadge est w-5 h-5)

---

### 2.4 Input / Textarea / Select / Checkbox / RangeSlider

**Fichier** : `bivouac-input.tsx`

**BILAN : Ces composants ne sont JAMAIS importés dans l'app.**

**Problème de style** : `bivouac-input.tsx` utilise `border-2 border-gray-300` mais les inputs inline dans l'app utilisent `border border-gray-200` (border-1 + couleur plus claire). Les styles sont proches mais pas identiques.

**Usages attendus mais manquants** :
- `Input` → `AddPoiPanel` (titre ligne 278, url photo ligne 358), `LoginPanel` (email ligne 73, password ligne 82), `CustomZoneForm` (nom, source url)
- `Textarea` → `AddPoiPanel` (description ligne 295, réglementation ligne 495), `PoiDetailsPanel` (review ligne 701), `CustomZoneForm` (description ligne 261)
- `Select` → non utilisé
- `Checkbox` → `AddPoiPanel` (réglementation ligne 476, parc national ligne 486)
- `RangeSlider` → `RoutePanel` (maxDistance lignes 84–101)

---

### 2.5 Panel / PanelSection / PanelActions

**Fichier** : `bivouac-panel.tsx`

**BILAN : Bien adopté pour les panneaux principaux. Un doublon existe dans CustomZonesEditor.**

**Props** : `onClose`, `title`, `icon?`, `mobileMaxHeight?` (défaut : `calc(100vh - 120px)`), `stickyFooter?`, `className?`

**Comportement responsive** :
- Mobile (`md:hidden`) : bottom-sheet avec drag handle, z-1000, `rounded-t-3xl`
- Desktop (`hidden md:flex`) : sidebar gauche, `top-[82px] left-6 w-[480px]`, z-500, `rounded-b-xl`

**Usages dans l'app** :
- ✅ `ZoneInfoPanel`, `AddPoiPanel`, `FilterPanel`, `PoiDetailsPanel`, `LoginPanel`, `RoutePanel`
- ❌ `CustomZonesEditor` : réimplémente son propre bottom-sheet + sidebar (lignes 131–158)

**Bug critique** : `bivouac-ui.tsx` exporte `PanelHeader` depuis `bivouac-panel.tsx`, mais ce composant **n'existe pas** dans `bivouac-panel.tsx`. → Erreur TypeScript à la compilation si quelqu'un l'importe.

---

## 3. Composants applicatifs hors DS

### 3.1 SearchBar

**Fichier** : `SearchBar.tsx`
**N'utilise aucun composant bivouac-***

Contient ses propres implémentations inline :
- Bouton "Ajouter" (ligne 401–408) : `bg-emerald-600 text-white rounded-lg hover:bg-emerald-700` = BivouacButton primary, non réutilisé
- Badge filtre actif (lignes 278, 393) : `bg-emerald-600 text-white text-xs font-bold rounded-full w-4 h-4` = CountBadge à taille réduite (w-4 vs w-5)
- Input de recherche : styles proches de BivouacInput mais différents (`bg-gray-100`, sans `border-2`)
- Dropdown résultats : `bg-white rounded-xl shadow-2xl border border-gray-100` — card custom non standardisée

### 3.2 FilterPanel

**Fichier** : `FilterPanel.tsx`
**Utilise** : Panel ✅

Contient :
- **FilterChip** (composant local, non exporté, lignes 158–186) : bouton toggle avec `flex items-center border-2 rounded-lg` + activeColor dynamique. **Pattern identique** aux boutons saison/capacité de `AddPoiPanel` — copié-collé, jamais unifié.
- Bouton "Réinitialiser" (ligne 147) : `bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg` = BivouacButton ghost/secondary, non utilisé

### 3.3 AddPoiPanel

**Fichier** : `AddPoiPanel.tsx`
**Utilise** : Panel ✅, BivouacButton ✅

Contient :
- 4 blocs AlertCard inline répétés (erreurs zone, avertissements zone, OSM blocked, OSM warnings) — lignes 200–269
- Inputs bruts `border border-gray-200 rounded-lg px-3 py-2` au lieu de BivouacInput
- Boutons toggle-chip saison/capacité (lignes 388–436) — même pattern que FilterChip dans FilterPanel, non unifié
- Sélecteur de difficulté (lignes 444–469) — copié depuis FilterPanel, identique

### 3.4 PoiDetailsPanel

**Fichier** : `PoiDetailsPanel.tsx`
**Utilise** : Panel ✅, BivouacButton ✅

Contient :
- Badge saison custom (lignes 367–371) via `getSeasonStyle()` — devrait utiliser SeasonBadge
- Badges altitude + GPS custom (lignes 373–392) — pattern badge inline non documenté
- Badges eau (lignes 395–428) — pattern badge inline non documenté
- 6+ blocs AlertCard inline (zones réglementées custom, zones OSM, réglementation spot) — lignes 491–628
- Card météo custom `bg-sky-50 rounded-lg p-3` (ligne 631) — pattern InfoCard
- Card évaluation custom `bg-amber-50 rounded-lg p-4` (ligne 678) — pattern Card
- Textarea review brute (ligne 701)
- Photo modal ad-hoc avec z-[1100]

### 3.5 LoginPanel

**Fichier** : `LoginPanel.tsx`
**Utilise** : Panel ✅, BivouacButton ✅

Contient :
- 2 inputs email/password bruts — devraient utiliser BivouacInput
- Error block inline `bg-red-50 border border-red-200 text-red-700 rounded-lg` (ligne 96) — AlertCard type="error"

### 3.6 RoutePanel

**Fichier** : `RoutePanel.tsx`
**Utilise** : Panel ✅, BivouacButton ✅

Contient :
- Instructions block inline `bg-emerald-50 border-l-4 border-emerald-400 p-3 rounded-r-lg` (lignes 36–41) — AlertCard type="success"
- 2 InfoCard inline (lignes 44–53) — devrait utiliser InfoCard composant
- Range slider brut (lignes 86–101) — devrait utiliser RangeSlider composant
- Checkbox brute (lignes 60–75) — devrait utiliser Checkbox composant

### 3.7 CustomZonesEditor

**Fichier** : `CustomZonesEditor.tsx`
**N'utilise PAS Panel — réimplémente le pattern complet**

Doublon critique :
- Mobile (lignes 133–144) : `fixed inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl z-[1000]` + `slideUp` = identique à Panel mobile
- Desktop (lignes 147–157) : `fixed top-[158px] left-6 w-[480px] bg-white shadow-2xl z-[500] rounded-b-xl` = Panel desktop mais avec `top-[158px]` au lieu de `top-[82px]`

⚠️ Incohérence de positionnement : Panel utilise `top-[82px]`, CustomZonesEditor utilise `top-[158px]`, le token `--panel-top-desktop` vaut `158px`.

### 3.8 CustomZoneForm

**Fichier** : `CustomZoneForm.tsx`
**Utilise** : BivouacButton ✅ · Panel : non (positionnement intentionnellement différent)

Positionnement unique et intentionnel : `fixed bottom-4 right-4 w-[22rem]` — formulaire flottant en superposition sur la carte, différent des sidepanels.

Contient :
- Inputs bruts avec `inputClass` / `smallInputClass` constants locales
- **Toggle** custom (lignes 26–41) — switch on/off non documenté, non exporté
- Error block inline (ligne 238) — AlertCard type="error"

### 3.9 MapControls

**Fichier** : `MapControls.tsx`
**N'utilise aucun composant bivouac-***

Pattern de bouton répété ~12 fois :
```tsx
className={`w-10 h-10 rounded-lg transition-all flex items-center justify-center ${
  isActive ? 'bg-{color}-600 text-white' : 'text-gray-700 hover:bg-gray-100'
}`}
```

Couleurs actives : blue-600, purple-600, red-600, sky-600, cyan-600, amber-500, emerald-700, blue-600, purple-600, emerald-600.

Aucun composant DS ne couvre ce cas (icon-only avec état toggle).

### 3.10 WaterPointsInfo

**Fichier** : `WaterPointsInfo.tsx`
**N'utilise aucun composant bivouac-***

Contient :
- Overlay modal custom `fixed inset-0 z-[1100] bg-black/50`
- 3 AlertCard inline (bg-blue-50, bg-yellow-50, bg-emerald-50)
- Bouton "J'ai compris" = BivouacButton primary non utilisé

---

## 4. Patterns visuels récurrents non encapsulés

### 4.1 AlertCard inline

**Fréquence** : ≥12 occurrences dans 5 fichiers différents  
**Pattern** : `bg-{color}-50 border-l-4 border-{color}-{400|500} p-{2.5|3|4} rounded-r-lg`

| Fichier | Occurrences | Types |
|---|---|---|
| `AddPoiPanel.tsx` | 4 | error (×2), warning (×2) |
| `PoiDetailsPanel.tsx` | 6+ | error, warning, info |
| `LoginPanel.tsx` | 1 | error |
| `RoutePanel.tsx` | 1 | success |
| `ZoneInfoPanel.tsx` | 2 | warning, gray |
| `WaterPointsInfo.tsx` | 3 | info, warning, success |

**Composant existant** : `AlertCard` dans `bivouac-card.tsx` — couvre le pattern mais n'est jamais utilisé.

### 4.2 InfoCard inline

**Fréquence** : 2 occurrences dans `RoutePanel.tsx`  
**Pattern** : `bg-{color}-50 rounded-lg p-3` + `text-xs {color}-600 font-medium mb-1` + `text-2xl font-bold {color}-700`

**Composant existant** : `InfoCard` dans `bivouac-card.tsx` — correspond exactement.

### 4.3 Toggle-chip buttons

**Fréquence** : 3 endroits distincts (FilterPanel, AddPoiPanel ×2, AddPoiPanel ×1)  
**Pattern** : `flex items-center gap-2 px-{3|4} py-{2|2.5} rounded-lg border-2 transition-all text-sm font-medium` avec classes actives conditionnelles

| Fichier | Usage | Composant local ? |
|---|---|---|
| `FilterPanel.tsx` | Filtre saison, eau, capacité | `FilterChip` local |
| `AddPoiPanel.tsx` | Sélection saison (×1), capacité (×1) | Aucun — inline |

**Pas de composant DS pour ce pattern.**

### 4.4 Sélecteur de difficulté

**Fréquence** : 2 occurrences (AddPoiPanel lignes 444–469, FilterPanel lignes 128–144)  
**Pattern** : grille de 6 boutons (0–5) avec couleurs progressives vert→rouge

Code identique copié-collé entre les deux composants. Même fonction `difficultyColor()` réimplémentée dans FilterPanel, inline dans AddPoiPanel.

### 4.5 Badge inline (tags)

**Fréquence** : 8+ occurrences dans PoiDetailsPanel  
**Pattern** : `flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-{color}-{50|100} text-{color}-{600|700|900}`

Couvre : saison, altitude, GPS, eau proche, eau naturelle.  
`SeasonBadge` couvre partiellement (saison uniquement, en rounded-full).

### 4.6 Input/textarea brut

**Fréquence** : ≥10 occurrences dans 4 fichiers  
**Pattern** : `border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none`

Légèrement différent du composant `Input` qui utilise `border-2 border-gray-300`.

---

## 5. Divergences documentation vs code réel

### 5.1 Bug export PanelHeader (critique)

`bivouac-ui.tsx` ligne 37 :
```tsx
export {
  Panel,
  PanelHeader,   // ← N'existe pas dans bivouac-panel.tsx
  PanelSection,
  PanelActions,
} from './bivouac-panel';
```

`PanelHeader` n'est défini nulle part. Toute tentative d'import depuis `bivouac-ui` échouera.

### 5.2 Couleur hiver incohérente

| Source | Valeur |
|---|---|
| `DESIGN_SYSTEM.md` | `#64748b` (slate-500) — "gris ardoise" |
| `design-tokens.css` `--color-season-winter` | `#60a5fa` (blue-400) — bleu |
| `SeasonBadge` hiver | `bg-slate-100 text-slate-800` — gris |

Trois valeurs différentes pour la même sémantique.

### 5.3 Top positioning des panels incohérent

| Source | Valeur |
|---|---|
| `design-tokens.css` `--panel-top-desktop` | `158px` |
| `DESIGN_SYSTEM.md` | `top-[158px]` |
| `Panel` component desktop | `top-[82px]` ← utilisé réellement |
| `CustomZonesEditor` desktop | `top-[158px]` |

Panel.tsx et CustomZonesEditor.tsx sont positionnés différemment. Le token est aligné sur CustomZonesEditor mais pas sur Panel.

### 5.4 Backdrop blur documenté mais non implémenté dans Panel

`DESIGN_SYSTEM.md` documente :
```
className="hidden md:block fixed top-[158px] left-6 w-[480px] bg-white/70 backdrop-blur-md border border-white/30 shadow-2xl z-[500]"
```

`Panel` réel utilise `bg-white` (solide, sans backdrop-blur). Le token `--backdrop-blur: 12px` est défini mais non utilisé dans Panel.

### 5.5 Secondary button sémantique

`DESIGN_SYSTEM.md` présente le variant "Secondary" comme `bg-blue-600 text-white` (bouton navigation/route).  
`BivouacButton` variant `secondary` est `bg-white border border-gray-200 text-gray-700` (équivalent visuel d'outline).

Ce sont deux conceptions différentes. La documentation décrit une intention abandonnée.

### 5.6 Composants documentés non implémentés

`README_DESIGN_SYSTEM.md` documente `PanelHeader` comme composant distinct avec props `title` et `icon`. Dans le code réel, ces props sont passées directement à `Panel`. Le composant `PanelHeader` en tant que sous-composant n'a jamais été créé.

### 5.7 Référence à DESIGN_SYSTEM_EXAMPLES.tsx

Les deux documentations référencent `/DESIGN_SYSTEM_EXAMPLES.tsx` mais ce fichier **n'existe pas** dans le repo.

### 5.8 Tokens référencés dans DESIGN_SYSTEM.md mais définis ailleurs

`DESIGN_SYSTEM.md` indique "CSS Variables définies dans `/src/styles/theme.css`" pour `--radius-sm`, `--radius-md`, etc. Ces variables sont effectivement dans `theme.css` via `@theme inline`, mais les composants n'y font pas référence — ils utilisent des classes Tailwind directes (`rounded-lg`, `rounded-xl`).

---

## 6. Tokens CSS : utilisés vs inutilisés

### Tokens réellement utilisés dans le code TSX

| Token | Utilisé dans |
|---|---|
| Aucun token design-tokens.css | — |

**Constat** : aucun token de `design-tokens.css` n'est référencé dans le code TSX de l'application. Tous les composants utilisent des valeurs Tailwind hardcodées. Les classes CSS utilitaires `.panel-desktop`, `.panel-mobile`, `.searchbar-container`, `.marker-*` définies dans `design-tokens.css` ne sont pas non plus utilisées.

### Tokens réellement utilisés dans le CSS

Les keyframes `slideUp` et `fadeIn` de `design-tokens.css` sont utilisées inline via `style={{ animation: 'slideUp 0.3s ease-out' }}` dans `Panel` et `CustomZonesEditor`.

### Tokens inutilisés (jamais référencés nulle part)

- `--color-season-spring-hover`, `--color-season-spring-light`, `--color-season-spring-dark`
- `--color-season-summer-hover`, `--color-season-summer-light`, `--color-season-summer-dark`
- `--color-season-winter` (bleu), `--color-season-winter-hover/light/dark`
- `--color-route`, `--color-route-hover/light/dark`
- `--color-water`, `--color-water-hover/light`
- `--color-regulation-ok/warning/forbidden`
- `--spacing-panel-gap`, `--spacing-panel-content`, `--spacing-section`
- `--spacing-grid-sm/md/lg`
- `--panel-width-desktop`, `--panel-top-desktop`, `--panel-radius-top/bottom`
- `--searchbar-width-max`, `--searchbar-gap`
- `--marker-size-sm/md/lg`, `--marker-border-width/color`
- `--shadow-panel`, `--shadow-card`, `--shadow-marker`, `--shadow-button`
- `--backdrop-blur`, `--backdrop-opacity`, `--backdrop-border-opacity`
- `--z-map`, `--z-panels`, `--z-searchbar`, `--z-mobile-panel`, `--z-modal`
- `--transition-fast/normal/slow`
- `--animation-slide-up`, `--animation-fade-in`, `--animation-pulse`
- `--breakpoint-md/lg/xl`

---

## 7. Récapitulatif des actions Phase 2

### Actions critiques

| Priorité | Action | Impact |
|---|---|---|
| 🔴 | Supprimer l'export fantôme `PanelHeader` de `bivouac-ui.tsx` | Bug TypeScript |
| 🔴 | Homogénéiser le positionnement `top-[82px]` vs `top-[158px]` des panels | Incohérence layout |
| 🔴 | Faire adopter `AlertCard` par tous les composants (12+ occurrences inline) | Duplication massive |

### Actions importantes

| Priorité | Action | Impact |
|---|---|---|
| 🟠 | Faire adopter `InfoCard` par `RoutePanel` (2 occurrences) | Duplication |
| 🟠 | Unifier les styles d'input (border-1 gray-200 vs border-2 gray-300) | Incohérence visuelle |
| 🟠 | Faire adopter `BivouacInput` dans tous les formulaires | 10+ occurrences |
| 🟠 | Refactoriser `CustomZonesEditor` pour utiliser `Panel` | Doublon complet |
| 🟠 | Créer un composant `FilterChip` partagé | Copier-coller ×3 |
| 🟠 | Créer un composant `DifficultySelector` partagé | Copier-coller ×2 |

### Actions mineures / cosmétiques

| Priorité | Action | Impact |
|---|---|---|
| 🟡 | Utiliser `SeasonBadge` dans `PoiDetailsPanel` | Cohérence DS |
| 🟡 | Utiliser `BivouacButton` dans `SearchBar` (bouton Ajouter) | Cohérence DS |
| 🟡 | Utiliser `BivouacButton` dans `WaterPointsInfo` (bouton fermer) | Cohérence DS |
| 🟡 | Aligner couleur hiver (`#64748b` ou `#60a5fa`) | Incohérence sémantique |
| 🟡 | Supprimer `/DESIGN_SYSTEM_EXAMPLES.tsx` des docs (fichier inexistant) | Doc fausse |

### Tokens et documentation

| Priorité | Action |
|---|---|
| 🟡 | Décider si les tokens CSS sont utilisables via `var()` ou si Tailwind suffit |
| 🟡 | Si Tailwind suffit : épurer `design-tokens.css` pour ne garder que les keyframes |
| 🟡 | Corriger la valeur `--panel-top-desktop` pour l'aligner sur le code réel |
| 🟡 | Corriger la couleur hiver dans les tokens |

---

*Fin de l'audit Phase 1.*
