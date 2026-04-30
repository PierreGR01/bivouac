# 💧 Fonctionnalité Points d'Eau depuis OpenStreetMap

## Vue d'ensemble

Cette fonctionnalité permet d'afficher en temps réel les points d'eau (sources, fontaines, puits, etc.) extraits depuis OpenStreetMap via l'API Overpass directement sur la carte.

## 🎯 Fonctionnalités

### Types de points d'eau détectés

1. **Fontaines et points d'eau potable** (`amenity=drinking_water`, `amenity=water_point`)
2. **Sources naturelles** (`natural=spring`)
3. **Puits** (`man_made=water_well`)
4. **Cascades** (`waterway=waterfall`) - pour information

### Limitation intelligente de l'affichage

Pour éviter la surcharge visuelle et optimiser les performances :
- **Maximum 35 points d'eau** affichés simultanément
- **Priorité aux points proches** des spots de bivouac existants
- Calcul de distance automatique (formule de Haversine)
- Tri par proximité croissante

**Exemple :**
- Si 100 points d'eau sont trouvés dans la zone
- Seuls les 35 plus proches des spots de bivouac sont affichés
- Un compteur indique "35 points d'eau (100 trouvés, 35 max affichés)"

### Informations affichées

Pour chaque point d'eau :
- ✅ **Nom** (si disponible dans OSM)
- ✅ **Type** (fontaine, source, puits, etc.)
- ✅ **Potabilité** (eau potable ou non)
- ✅ **Saisonnalité** (peut être à sec en été)
- ✅ **Accès** (public, privé, sur autorisation)
- ✅ **Description** (si disponible)

## 🎨 Interface utilisateur

### Bouton d'activation

Un nouveau bouton "Points d'eau" est ajouté dans la SearchBar :
- **Icône** : Goutte d'eau (Droplet)
- **État inactif** : Gris clair
- **État actif** : Bleu ciel
- **Position** : Entre "Filtres" et "Itinéraire"

### Marqueurs sur la carte

Deux types de marqueurs distincts :

#### Eau potable
- **Couleur** : Bleu ciel clair (`#0ea5e9`)
- **Icône** : Goutte d'eau blanche
- **Taille** : 20x20px
- **Z-index** : -100 (sous les marqueurs de bivouac)

#### Eau non potable
- **Couleur** : Bleu foncé (`#0284c7`)
- **Icône** : Goutte d'eau blanche
- **Taille** : 20x20px

### Popup d'informations

Au clic sur un marqueur, une popup affiche :
```
[Nom du point d'eau]
• ✓ Eau potable / ✗ Eau non potable
• Saisonnier (peut être à sec)
• Accès privé / public
• Description supplémentaire
Source: OpenStreetMap
```

## 🔧 Architecture technique

### Fichiers créés

#### `/src/app/services/overpass.ts`
Service principal pour interroger l'API Overpass d'OpenStreetMap.

**Fonctions exportées :**

```typescript
// Récupérer les points d'eau dans une zone
fetchWaterPoints(bounds: Bounds, timeout?: number): Promise<WaterPoint[]>

// Déterminer si un point d'eau est potable
isDrinkable(waterPoint: WaterPoint): boolean

// Obtenir un label lisible
getWaterPointLabel(waterPoint: WaterPoint): string

// Obtenir les informations détaillées
getWaterPointInfo(waterPoint: WaterPoint): string[]

// Filtrer et trier par proximité (35 max)
filterAndSortWaterPoints(
  waterPoints: WaterPoint[], 
  spots: Array<{ lat: number; lng: number }>,
  maxPoints?: number
): WaterPoint[]
```

**Interface WaterPoint :**
```typescript
interface WaterPoint {
  id: string;
  type: 'node' | 'way';
  lat: number;
  lng: number;
  tags: {
    name?: string;
    amenity?: string;
    natural?: string;
    man_made?: string;
    drinking_water?: string;
    seasonal?: string;
    access?: string;
    description?: string;
  };
  waterType: 'drinking_water' | 'spring' | 'water_well' | 'water_point' | 'stream' | 'waterfall';
}
```

### Modifications des composants existants

#### `MapView.tsx`
- **Nouvelle prop** : `showWaterPoints?: boolean`
- **Nouveaux hooks** : `waterPoints`, `isLoadingWater`
- **Nouvelle ref** : `waterMarkersRef`
- **Nouveaux useEffect** :
  - Charger les points d'eau quand la carte bouge
  - Afficher/masquer les marqueurs

#### `SearchBar.tsx`
- **Nouvelles props** : `showWaterPoints`, `onWaterPointsToggle`
- **Nouveau bouton** : Toggle des points d'eau

#### `App.tsx`
- **Nouvel état** : `showWaterPoints`
- **Props transmises** à MapView et SearchBar

#### `leaflet.css`
- **Nouvelles classes** : `.water-marker`, `.water-marker-drinkable`
- **Nouvelle animation** : `waterDrop` au hover

## 📡 API Overpass

### Endpoint utilisé
```
https://overpass-api.de/api/interpreter
```

### Requête OverpassQL
```overpassql
[out:json][timeout:25];
(
  node["amenity"="drinking_water"](bounds);
  node["amenity"="water_point"](bounds);
  node["natural"="spring"](bounds);
  node["man_made"="water_well"](bounds);
  node["waterway"="waterfall"](bounds);
);
out body;
>;
out skel qt;
```

### Performance

- **Debounce** : 1 seconde après l'arrêt du mouvement de la carte
- **Timeout** : 25 secondes par défaut
- **Limites** : Requêtes limitées aux bounds visibles
- **Cache** : Les points sont rechargés uniquement au déplacement

## 🎯 Logique de potabilité

### Eau potable ✓
- `waterType = 'drinking_water'` ou `'water_point'`
- `waterType = 'spring'` ET `drinking_water ≠ 'no'`
- `waterType = 'water_well'` ET `drinking_water = 'yes'`

### Eau non potable ✗
- `drinking_water = 'no'` (explicite)
- `waterType = 'waterfall'`
- `waterType = 'water_well'` sans tag `drinking_water`

## 💡 Utilisation

### Pour l'utilisateur

1. **Activer** : Cliquer sur le bouton "Points d'eau" dans la SearchBar
2. **Visualiser** : Les points d'eau apparaissent sur la carte avec des marqueurs bleus
3. **Consulter** : Cliquer sur un marqueur pour voir les détails
4. **Désactiver** : Cliquer à nouveau sur le bouton pour masquer les points

### Pour le développeur

```tsx
// Dans App.tsx
const [showWaterPoints, setShowWaterPoints] = useState(false);

<SearchBar
  showWaterPoints={showWaterPoints}
  onWaterPointsToggle={() => setShowWaterPoints(!showWaterPoints)}
/>

<MapView
  showWaterPoints={showWaterPoints}
  // ... autres props
/>
```

## 📊 Tags OSM utilisés

| Tag OSM | Signification | Traitement |
|---------|---------------|------------|
| `amenity=drinking_water` | Fontaine potable | ✓ Potable |
| `amenity=water_point` | Point d'eau (camping) | ✓ Potable |
| `natural=spring` | Source naturelle | ✓ Potable si non indiqué autrement |
| `man_made=water_well` | Puits | ✓ Si `drinking_water=yes` |
| `waterway=waterfall` | Cascade | ✗ Non potable |
| `drinking_water=yes/no` | Indication potabilité | Respectée |
| `seasonal=yes` | Saisonnier | Affiché en info |
| `access=private/permissive` | Restriction accès | Affiché en info |

## 🔒 Sécurité et limites

### Avertissements

⚠️ **Important** : Les données proviennent d'OpenStreetMap et sont fournies par la communauté.

- Les informations peuvent être **obsolètes**
- La potabilité n'est pas garantie
- Certains points peuvent être **saisonniers** (à sec en été)
- Toujours **vérifier sur place** avant de consommer l'eau
- En cas de doute, **traiter l'eau** avant consommation

### Limites techniques

- **Débit API** : Overpass API peut avoir des limites de requêtes
- **Timeout** : Requêtes annulées après 25s
- **Données** : Dépendent de la qualité des contributions OSM
- **Couverture** : Variable selon les régions

## 🚀 Améliorations futures possibles

### Fonctionnalités
- [ ] Filtre par type de point d'eau
- [ ] Calcul de distance depuis position utilisateur
- [ ] Itinéraire vers le point d'eau le plus proche
- [ ] Photos des points d'eau (depuis Wikimedia)
- [ ] Commentaires communautaires
- [ ] Signaler une erreur / Contribuer à OSM

### Performance
- [ ] Cache local des points d'eau
- [ ] Clustering des marqueurs si trop nombreux
- [ ] Préchargement des zones adjacentes
- [ ] Service Worker pour offline

### Données
- [ ] Intégration IGN (si API disponible)
- [ ] Données météo (débit des sources)
- [ ] Qualité de l'eau (analyses officielles)
- [ ] Contributions utilisateurs

## 📚 Ressources

### Documentation OSM
- [Tags for water points](https://wiki.openstreetmap.org/wiki/Tag:amenity%3Ddrinking_water)
- [Natural springs](https://wiki.openstreetmap.org/wiki/Tag:natural%3Dspring)
- [Water wells](https://wiki.openstreetmap.org/wiki/Tag:man_made%3Dwater_well)

### API Overpass
- [Overpass API Documentation](https://wiki.openstreetmap.org/wiki/Overpass_API)
- [Overpass QL Guide](https://wiki.openstreetmap.org/wiki/Overpass_API/Language_Guide)
- [Overpass Turbo](https://overpass-turbo.eu/) - Tester les requêtes

## 🎉 Conclusion

Cette fonctionnalité enrichit considérablement l'application en permettant aux randonneurs et bivouaqueurs de localiser facilement les points d'eau disponibles sur leur itinéraire. Elle s'intègre parfaitement avec les autres fonctionnalités existantes (filtres, itinéraires) et utilise les données ouvertes d'OpenStreetMap pour un service gratuit et communautaire.
