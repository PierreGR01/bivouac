# Test de la fonctionnalité Zones Réglementées - Chartreuse

## 🧪 Plan de test

### Test 1 : Activation du bouton "Zones interdites"

**Objectif** : Vérifier que seules les zones strictement interdites apparaissent

**Étapes** :
1. Naviguer vers la région de Chartreuse (45.45°N, 5.88°E)
2. Cliquer sur le bouton "Zones interdites" (bouclier rouge)
3. Observer la carte

**Résultat attendu** :
- ✅ Le bouton devient rouge
- ✅ Un compteur apparaît en haut à droite : "X zone(s) interdite(s)"
- ✅ Des polygones rouges apparaissent pour :
  - Réserves naturelles (si présentes dans la zone)
  - Parcs nationaux voisins (Écrins, Vanoise si visibles)
- ❌ PAS de polygone pour le Parc Naturel Régional de Chartreuse

**Critère de succès** : Le PNR Chartreuse ne doit PAS apparaître sur la carte

---

### Test 2 : Popup d'une zone interdite

**Objectif** : Vérifier les informations affichées au clic sur une zone

**Étapes** :
1. Activer "Zones interdites"
2. Cliquer sur un polygone rouge (réserve naturelle)
3. Lire le contenu de la popup

**Résultat attendu** :
```
Nom de la zone (ex: "Réserve Naturelle des Hauts de Chartreuse")

• 🚫 Camping et bivouac strictement interdits
• 🚶 Rester sur les sentiers balisés
• 🌿 Zone de protection de la faune et flore
• 📸 Observation autorisée uniquement
• ⚖️ Amendes possibles en cas de non-respect

Source: OpenStreetMap
```

**Critère de succès** : Message clair sur l'interdiction de camping

---

### Test 3 : Spot dans le PNR Chartreuse

**Objectif** : Vérifier l'encart d'information dans les détails du spot

**Prérequis** : Créer un spot de test en Chartreuse
- Nom : "Sommet de Chamechaude"
- Coordonnées : 45.293°N, 5.788°E (dans le PNR)

**Étapes** :
1. Créer le spot de test
2. Activer "Zones interdites" (facultatif)
3. Cliquer sur le marqueur du spot
4. Observer le panneau de détails

**Résultat attendu** :
```
┌────────────────────────────────────────────┐
│ 🛡️ Zone réglementée                       │
│                                            │
│ Parc Naturel Régional de Chartreuse        │
│                                            │
│ Parc Naturel Régional - Réglementation     │
│ modérée                                    │
│                                            │
│ • ⚠️ Bivouac toléré avec précautions      │
│ • 🕐 Installation après 19h, départ avant  │
│   9h                                       │
│ • 🏞️ Rester à distance des habitations    │
│   (minimum 200m)                           │
│ • ♻️ Ne laisser aucune trace               │
│ • 🔥 Feux interdits sauf réchauds          │
│                                            │
│ Plus d'informations →                      │
└────────────────────────────────────────────┘
```

**Critère de succès** : 
- Encart **orange** (pas rouge)
- Mention explicite du bivouac toléré avec horaires
- Lien vers le site du parc (si disponible dans OSM)

---

### Test 4 : Spot dans une réserve naturelle

**Objectif** : Vérifier l'encart d'interdiction stricte

**Prérequis** : Créer un spot de test dans une réserve
- Nom : "Falaise interdite"
- Coordonnées : Dans une réserve naturelle

**Étapes** :
1. Créer le spot de test
2. Cliquer sur le marqueur

**Résultat attendu** :
```
┌────────────────────────────────────────────┐
│ ⚠️ Zone interdite                          │
│                                            │
│ Réserve Naturelle [Nom]                    │
│                                            │
│ Réserve Naturelle - Protection stricte de  │
│ la biodiversité                            │
│                                            │
│ • 🚫 Camping et bivouac strictement       │
│   interdits                                │
│ • 🚶 Rester sur les sentiers balisés      │
│ • 🌿 Zone de protection de la faune et     │
│   flore                                    │
│ • 📸 Observation autorisée uniquement      │
│ • ⚖️ Amendes possibles en cas de          │
│   non-respect                              │
└────────────────────────────────────────────┘
```

**Critère de succès** :
- Encart **rouge** (pas orange)
- Mention explicite de l'interdiction
- Avertissement sur les amendes

---

### Test 5 : Spot hors zone protégée

**Objectif** : Vérifier qu'aucun encart ne s'affiche

**Prérequis** : Créer un spot hors de toute zone
- Nom : "Spot libre"
- Coordonnées : En dehors de toute zone protégée

**Étapes** :
1. Créer le spot
2. Cliquer sur le marqueur

**Résultat attendu** :
- ❌ Aucun encart de zone protégée
- ✅ Seulement les informations du spot (description, photos, etc.)

**Critère de succès** : Pas d'encart orange ni rouge

---

### Test 6 : Performance de chargement

**Objectif** : Vérifier le cache et le rate limiting

**Étapes** :
1. Activer "Zones interdites"
2. Observer le message "Chargement des zones réglementées..."
3. Attendre le chargement
4. Déplacer légèrement la carte
5. Attendre 3 secondes
6. Déplacer à nouveau la carte

**Résultat attendu** :
- Premier chargement : 2-5 secondes
- Chargements suivants (même zone) : instantané (cache)
- Minimum 8 secondes entre deux requêtes API
- Message de chargement affiché pendant les requêtes

**Critère de succès** : Pas de surcharge de l'API Overpass

---

### Test 7 : Spot à la frontière de plusieurs zones

**Objectif** : Vérifier l'affichage de plusieurs encarts

**Prérequis** : Trouver un spot à la frontière d'un PNR et d'une réserve

**Résultat attendu** :
```
┌────────────────────────┐
│ ⚠️ Zone interdite     │  ← Premier encart (rouge)
│ Réserve Naturelle      │
└────────────────────────┘

┌────────────────────────┐
│ 🛡️ Zone réglementée   │  ← Deuxième encart (orange)
│ PNR Chartreuse         │
└────────────────────────┘
```

**Critère de succès** : Tous les encarts s'affichent dans l'ordre (zones interdites d'abord)

---

### Test 8 : Désactivation du bouton

**Objectif** : Vérifier que les polygones disparaissent

**Étapes** :
1. Activer "Zones interdites"
2. Attendre l'affichage des polygones
3. Cliquer à nouveau sur le bouton

**Résultat attendu** :
- ✅ Le bouton redevient gris
- ✅ Tous les polygones disparaissent de la carte
- ✅ Le compteur disparaît
- ✅ Les encarts dans les spots restent affichés (indépendants du toggle)

**Critère de succès** : Carte propre sans polygones

---

## 📊 Données de test Chartreuse

### Coordonnées de référence

| Zone | Type | Latitude | Longitude | Attendu |
|------|------|----------|-----------|---------|
| Centre PNR Chartreuse | PNR | 45.35 | 5.85 | Encart orange |
| Chamechaude (sommet) | PNR | 45.293 | 5.788 | Encart orange |
| Col de Porte | PNR | 45.283 | 5.767 | Encart orange |
| Hors zone | Aucune | 45.50 | 5.90 | Pas d'encart |

### Tags OpenStreetMap attendus

Pour le PNR Chartreuse :
```json
{
  "boundary": "protected_area",
  "protect_class": "5",
  "name": "Parc naturel régional de Chartreuse",
  "name:fr": "Parc naturel régional de Chartreuse",
  "designation": "parc_naturel_régional",
  "website": "https://www.parc-chartreuse.net/"
}
```

---

## 🐛 Bugs potentiels à surveiller

### Bug 1 : Polygone PNR affiché sur la carte
**Symptôme** : Le PNR Chartreuse apparaît en orange/rouge
**Cause** : Fonction `shouldDisplayOnMap()` ne filtre pas correctement
**Fix** : Vérifier `protectionLevel === 'strict'`

### Bug 2 : Pas d'encart dans le spot
**Symptôme** : Spot en Chartreuse sans encart
**Cause** : Algorithme point-in-polygon défaillant
**Fix** : Vérifier la fonction `isPointInPolygon()`

### Bug 3 : Requêtes API trop fréquentes
**Symptôme** : Erreur 429 (Too Many Requests)
**Cause** : Rate limiting désactivé
**Fix** : Vérifier `MIN_REQUEST_INTERVAL = 8000`

### Bug 4 : Cache non utilisé
**Symptôme** : Rechargement à chaque mouvement
**Cause** : Clé de cache incorrecte
**Fix** : Vérifier `getCacheKey()` et arrondi des coordonnées

---

## ✅ Checklist de validation

Avant de considérer la fonctionnalité terminée :

- [ ] Bouton "Zones interdites" visible et fonctionnel
- [ ] Polygones rouges affichés uniquement pour zones strictes
- [ ] PNR Chartreuse NON affiché sur la carte
- [ ] Encart orange affiché dans spot Chartreuse
- [ ] Encart rouge affiché dans spot en réserve
- [ ] Pas d'encart pour spot hors zone
- [ ] Cache fonctionnel (30 minutes)
- [ ] Rate limiting respecté (8 secondes)
- [ ] Indicateurs de chargement présents
- [ ] Compteur de zones correct
- [ ] Popups des zones fonctionnelles
- [ ] Liens vers sites officiels cliquables
- [ ] Responsive (mobile + desktop)
- [ ] Performance acceptable (< 5s chargement initial)

---

## 🎯 Test final : Parcours utilisateur complet

**Scénario** : Un randonneur cherche un spot en Chartreuse

1. **Recherche** : Zoomer sur la Chartreuse
2. **Contexte** : Activer "Zones interdites" pour voir les zones à éviter
3. **Observation** : Constater que le PNR n'est pas en rouge (bon signe !)
4. **Sélection** : Cliquer sur un spot existant ou en créer un
5. **Information** : Lire l'encart orange du PNR avec les règles 19h-9h
6. **Décision** : Décider si le spot convient (bivouac toléré)
7. **Détails** : Cliquer sur "Plus d'informations" pour le site du parc

**Temps estimé** : 2-3 minutes

**Critère de succès** : L'utilisateur comprend instantanément qu'il peut bivouaquer en Chartreuse avec des précautions
