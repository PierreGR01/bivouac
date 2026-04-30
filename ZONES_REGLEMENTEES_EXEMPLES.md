# Exemples de Zones Réglementées

## 🗺️ Vue d'ensemble

Cette fonctionnalité adopte une approche **en deux niveaux** pour informer les utilisateurs :

1. **Niveau carte** : Affichage des zones où le camping est **strictement interdit**
2. **Niveau détails** : Affichage de toutes les réglementations (strictes + modérées) quand on consulte un spot

---

## 📍 Cas d'usage : Chartreuse

### Scénario 1 : Activation du bouton "Réglementation"

**Action** : L'utilisateur clique sur le bouton "Réglementation" 🛡️

**Résultat sur la carte** :
- ✅ Les **réserves naturelles** autour de la Chartreuse apparaissent en rouge
- ✅ Les **parcs nationaux** (Écrins, Vanoise) apparaissent en rouge
- ❌ Le **Parc Naturel Régional de Chartreuse** n'apparaît PAS (bivouac toléré)

**Pourquoi ?**
- Le PNR Chartreuse a un `protectionLevel = 'moderate'`
- Seules les zones `strict` sont affichées sur la carte
- But : éviter la surcharge visuelle et se concentrer sur les interdictions

---

### Scénario 2 : Consultation d'un spot en Chartreuse

**Setup** :
- Spot "Lac d'Aiguebelette" à `45.5478°N, 5.8064°E`
- Situé dans le Parc Naturel Régional de Chartreuse

**Action** : L'utilisateur clique sur le marqueur du spot

**Résultat dans le panneau de détails** :

```
╔════════════════════════════════════════════╗
║  📍 Lac d'Aiguebelette                     ║
║  45.5478°N, 5.8064°E                       ║
╠════════════════════════════════════════════╣
║  [Photos du spot]                          ║
║                                            ║
║  ┌──────────────────────────────────────┐ ║
║  │ 🛡️ Zone réglementée                  │ ║
║  │                                       │ ║
║  │ Parc Naturel Régional de Chartreuse   │ ║
║  │                                       │ ║
║  │ Parc Naturel Régional - Réglementation│ ║
║  │ modérée                               │ ║
║  │                                       │ ║
║  │ • ⚠️ Bivouac toléré avec précautions │ ║
║  │ • 🕐 Installation après 19h, départ   │ ║
║  │   avant 9h                            │ ║
║  │ • 🏞️ Rester à distance des habitations│ ║
║  │   (minimum 200m)                      │ ║
║  │ • ♻️ Ne laisser aucune trace          │ ║
║  │ • 🔥 Feux interdits sauf réchauds     │ ║
║  │                                       │ ║
║  │ Plus d'informations →                 │ ║
║  └──────────────────────────────────────┘ ║
║                                            ║
║  Description du spot...                    ║
╚════════════════════════════════════════════╝
```

**Encart orange** car bivouac toléré avec conditions

---

### Scénario 3 : Spot dans une Réserve Naturelle

**Setup** :
- Spot "Dent de Crolles" à `45.3123°N, 5.8456°E`
- Situé dans une **Réserve Naturelle Intégrale**

**Action** : L'utilisateur clique sur le marqueur

**Résultat** :

```
╔════════════════════════════════════════════╗
║  📍 Dent de Crolles                        ║
║  45.3123°N, 5.8456°E                       ║
╠════════════════════════════════════════════╣
║  ┌──────────────────────────────────────┐ ║
║  │ ⚠️ Zone interdite                    │ ║
║  │                                       │ ║
║  │ Réserve Naturelle Intégrale           │ ║
║  │                                       │ ║
║  │ Réserve Naturelle - Protection stricte│ ║
║  │ de la biodiversité                    │ ║
║  │                                       │ ║
║  │ • 🚫 Camping et bivouac strictement  │ ║
║  │   interdits                           │ ║
║  │ • 🚶 Rester sur les sentiers balisés │ ║
║  │ • 🌿 Zone de protection de la faune   │ ║
║  │   et flore                            │ ║
║  │ • 📸 Observation autorisée uniquement │ ║
║  │ • ⚖️ Amendes possibles en cas de     │ ║
║  │   non-respect                         │ ║
║  │                                       │ ║
║  │ Plus d'informations →                 │ ║
║  └──────────────────────────────────────┘ ║
╚════════════════════════════════════════════╝
```

**Encart rouge** car camping strictement interdit

---

## 🎯 Tableau récapitulatif

| Type de zone | Affichage carte | Affichage détails spot | Couleur encart | Camping autorisé ? |
|--------------|-----------------|------------------------|----------------|-------------------|
| **Parc National** | ✅ Polygone rouge | ✅ Encart | 🔴 Rouge | ❌ Interdit |
| **Réserve Naturelle** | ✅ Polygone rouge | ✅ Encart | 🔴 Rouge | ❌ Interdit |
| **PNR Chartreuse** | ❌ Pas affiché | ✅ Encart | 🟠 Orange | ⚠️ Bivouac toléré 19h-9h |
| **Zone Protégée générique** | ❌ Pas affiché | ✅ Encart | 🟠 Orange | ⚠️ À vérifier |
| **Hors zone** | - | - | - | ✅ Selon loi locale |

---

## 🔍 Détection des zones

### Algorithme utilisé

Pour déterminer si un spot est dans une zone :

1. **Récupération** : Toutes les zones de la région sont chargées
2. **Filtrage carte** : Seules les zones strictes (`protectionLevel === 'strict'`) sont affichées
3. **Vérification spot** : Pour chaque zone, algorithme **ray casting** (point-in-polygon)
4. **Affichage** : Si le spot est dans une ou plusieurs zones, afficher les encarts

### Formule point-in-polygon (ray casting)

```javascript
function isPointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    
    const intersect = ((yi > point.lat) !== (yj > point.lat)) &&
      (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }
  return inside;
}
```

---

## 💡 Cas particuliers

### Spot dans plusieurs zones

Si un spot est à la frontière de plusieurs zones (ex: PNR + Réserve), **tous les encarts** s'affichent :

```
┌─────────────────────────────────┐
│ ⚠️ Zone interdite               │
│ Réserve Naturelle XYZ           │
│ ...                             │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ 🛡️ Zone réglementée             │
│ Parc Naturel Régional           │
│ ...                             │
└─────────────────────────────────┘
```

**Ordre d'affichage** : Zones interdites en premier (rouge), puis zones réglementées (orange)

---

### Zone sans nom

Si la zone n'a pas de nom dans OpenStreetMap :

```
┌─────────────────────────────────┐
│ ⚠️ Zone interdite               │
│ Réserve Naturelle               │  ← Nom générique
│ ...                             │
└─────────────────────────────────┘
```

---

## 🛠️ Pour les développeurs

### Structure de données

```typescript
interface ProtectedArea {
  id: string;
  type: 'way' | 'relation';
  name?: string;
  geometry: Array<{ lat: number; lng: number }>;
  tags: {
    boundary?: string;
    leisure?: string;
    protect_class?: string;
    name?: string;
    website?: string;
  };
  areaType: 'national_park' | 'regional_park' | 'nature_reserve' | 'protected_area';
  protectionLevel: 'strict' | 'moderate' | 'low';
}
```

### Fonction de décision d'affichage

```typescript
function shouldDisplayOnMap(area: ProtectedArea): boolean {
  return area.protectionLevel === 'strict';
}
```

### Mapping OSM → Type de zone

| Tag OSM | `areaType` | `protectionLevel` |
|---------|------------|-------------------|
| `boundary=national_park` | `national_park` | `strict` |
| `leisure=nature_reserve` | `nature_reserve` | `strict` |
| `protect_class=1` | `nature_reserve` | `strict` |
| `protect_class=4` | `nature_reserve` | `strict` |
| `protect_class=5` | `regional_park` | `moderate` |
| `boundary=protected_area` | `protected_area` | `moderate` |
