# Fonctionnalité : Affichage des Zones Réglementées

## 📋 Description

Cette fonctionnalité permet d'identifier les zones où le camping sauvage est réglementé ou interdit :

### Sur la carte (polygones rouges)
- **Parcs Nationaux** - Camping strictement interdit
- **Réserves Naturelles** - Camping et bivouac interdits

### Dans les détails des spots (encarts d'information)
- **Parcs Naturels Régionaux** (ex: Chartreuse) - Bivouac réglementé
- **Zones Protégées** - Réglementation à vérifier localement

Les zones avec camping **strictement interdit** apparaissent sur la carte, tandis que les zones avec **réglementation modérée** n'apparaissent que dans les détails d'un spot situé dans la zone.

## 🎯 Utilisation

### Activer l'affichage des zones interdites

1. Cliquez sur le bouton **"Réglementation"** (icône bouclier 🛡️) dans la barre de navigation
2. Les zones où le camping est **strictement interdit** s'affichent en rouge sur la carte
3. Un compteur en haut à droite indique le nombre de zones interdites

### Consulter les informations d'une zone sur la carte

1. Cliquez sur un polygone rouge (zone interdite)
2. Une popup s'affiche avec :
   - Le nom de la zone (ex: "Parc National des Écrins")
   - Le type de protection
   - Les restrictions applicables
   - Un lien vers le site officiel (si disponible)

### Consulter les informations d'un spot

1. Cliquez sur un marqueur de bivouac
2. Si le spot est dans une zone réglementée, un **encart d'alerte** s'affiche :
   - 🔴 **Encart rouge** : Zone interdite (camping interdit)
   - 🟠 **Encart orange** : Zone réglementée (bivouac toléré avec conditions)
3. L'encart contient :
   - Le nom de la zone
   - La description de la réglementation
   - Les règles spécifiques à respecter
   - Un lien vers le site officiel

## 🎨 Codes couleurs

### Sur la carte
| Couleur | Type de zone | Affichage |
|---------|--------------|-----------|
| 🔴 **Rouge** | Parc National / Réserve Naturelle | **Polygone sur la carte** |

### Dans les détails du spot
| Couleur encart | Type de zone | Restrictions |
|----------------|--------------|--------------|
| 🔴 **Rouge** | Parc National / Réserve Naturelle | **Interdit** - Camping strictement interdit |
| 🟠 **Orange** | Parc Naturel Régional | **Réglementé** - Bivouac toléré avec conditions |

## 📍 Exemple : Chartreuse

### Comportement pour un spot dans le Parc de Chartreuse

Le **Parc Naturel Régional de Chartreuse** :
- ❌ **N'apparaît PAS sur la carte** (pas de polygone orange)
- ✅ **Apparaît dans les détails du spot** situé dans le parc

Quand vous cliquez sur un spot en Chartreuse, un **encart orange** s'affiche avec :

- 🛡️ **Parc Naturel Régional de Chartreuse**
- ⚠️ Bivouac toléré avec précautions
- 🕐 Installation après 19h, départ avant 9h
- 🏞️ Rester à distance des habitations (minimum 200m)
- ♻️ Ne laisser aucune trace
- 🔥 Feux interdits sauf réchauds

## ⚡ Fonctionnement technique

### Source de données
- **API Overpass** (OpenStreetMap) pour récupérer les zones protégées
- Tags OSM utilisés :
  - `boundary=national_park` (strict → carte)
  - `boundary=protected_area` + `protect_class=5` (modéré → détails)
  - `leisure=nature_reserve` (strict → carte)
  - `protect_class` (1, 4 → strict, 5 → modéré)

### Logique d'affichage
1. **Chargement** : Toutes les zones protégées sont récupérées (strictes + modérées)
2. **Carte** : Seules les zones `protectionLevel === 'strict'` sont affichées en rouge
3. **Détails du spot** : Algorithme point-in-polygon vérifie si le spot est dans une zone
4. **Encart** : Affiche toutes les zones contenant le spot (strictes ET modérées)

### Cache et performance
- **Cache de 30 minutes** (zones statiques, peu de changements)
- **Rate limiting** : 8 secondes minimum entre requêtes
- **Rechargement automatique** quand la carte bouge (debounce 3s)
- **Affichage des polygones** avec Leaflet
- **Détection point-in-polygon** avec algorithme ray casting

### Fichiers impliqués
```
/src/app/services/protected-areas.ts  - Service API Overpass pour zones protégées
/src/app/components/MapView.tsx       - Affichage des polygones sur la carte
/src/app/components/SearchBar.tsx     - Bouton de toggle
/src/app/App.tsx                      - État global de l'application
```

## 🚀 Améliorations possibles

- [ ] Filtrer par type de zone (parcs nationaux seulement, etc.)
- [ ] Afficher la réglementation directement sur la carte (sans clic)
- [ ] Ajouter d'autres types de zones (zones de quiétude, biotopes, etc.)
- [ ] Intégration avec les API officielles des parcs (données plus précises)
- [ ] Mode offline avec zones téléchargées

## ⚠️ Limitations

1. **Données OpenStreetMap** : Peuvent ne pas être exhaustives ou à jour
2. **Réglementation simplifiée** : Consultez toujours les sources officielles
3. **Zones complexes** : Certaines zones peuvent avoir des géométries complexes (multipolygones)
4. **API Overpass** : Peut être lente ou indisponible lors de pics de charge

## 📚 Ressources

- [OpenStreetMap Protected Areas](https://wiki.openstreetmap.org/wiki/Tag:boundary=protected_area)
- [Réglementation bivouac France](https://www.service-public.fr/particuliers/vosdroits/F31738)
- [Parc Naturel Régional de Chartreuse](https://www.parc-chartreuse.net/)
- [Parcs Nationaux de France](https://www.parcsnationaux.fr/)
