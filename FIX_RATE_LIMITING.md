# 🔧 Correction de l'erreur 429 - Rate Limiting API Overpass

## ❌ Problème identifié

L'API Overpass d'OpenStreetMap retournait des erreurs `429 Too Many Requests` :
- Requêtes trop fréquentes lors des déplacements sur la carte
- Pas de cache des résultats
- Debounce trop court (1 seconde)
- Pas de gestion de la limite de taux

## ✅ Solutions implémentées

### 1. **Système de cache intelligent** (`/src/app/services/overpass.ts`)

#### Cache basé sur les bounds
```typescript
interface CacheEntry {
  data: WaterPoint[];
  timestamp: number;
  bounds: string;
}

const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
```

**Fonctionnement :**
- Chaque zone géographique est mise en cache pendant **5 minutes**
- Les bounds sont arrondis à 3 décimales (~100m) pour regrouper les requêtes similaires
- Maximum **10 entrées** dans le cache (FIFO)
- Le cache est consulté **avant** toute requête API

### 2. **Rate limiting**

#### Intervalle minimum entre requêtes
```typescript
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 3000; // 3 secondes minimum
let pendingRequest: Promise<WaterPoint[]> | null = null;
```

**Fonctionnement :**
- **3 secondes minimum** entre deux requêtes API
- Si une requête est déjà en cours, elle est réutilisée
- Attente automatique si une requête est faite trop tôt
- Prévient les requêtes multiples simultanées

### 3. **Debounce augmenté** (`MapView.tsx`)

**Avant :** 1 seconde
**Après :** 3 secondes

```typescript
timeoutId = setTimeout(() => {
  loadWaterPoints();
}, 3000); // Augmenté de 1s à 3s
```

**Impact :**
- L'utilisateur doit **arrêter de bouger la carte pendant 3 secondes** avant qu'une requête soit faite
- Réduit drastiquement le nombre de requêtes lors du zoom/pan

### 4. **Gestion des erreurs 429**

#### Classe d'erreur personnalisée
```typescript
export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}
```

#### Fallback sur cache expiré
```typescript
if (error instanceof RateLimitError) {
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log('Utilisation du cache expiré en raison du rate limiting');
    return cached.data;
  }
}
```

**Fonctionnement :**
- Si une erreur 429 survient, le système vérifie si un cache existe (même expiré)
- Si oui, il retourne les données en cache plutôt que d'échouer
- L'utilisateur voit les points d'eau même si l'API est temporairement bloquée

### 5. **Interface utilisateur améliorée**

#### Indicateur de chargement
```tsx
{showWaterPoints && isLoadingWater && (
  <div className="loading-indicator">
    Chargement des points d'eau...
  </div>
)}
```

#### Messages d'erreur contextuels
```typescript
if (error?.name === 'RateLimitError') {
  setWaterError('Trop de requêtes. Les points d\'eau seront rechargés automatiquement.');
} else if (error?.message?.includes('429')) {
  setWaterError('API temporairement indisponible. Réessayez dans quelques instants.');
}
```

#### Composant d'information (`WaterPointsInfo.tsx`)
- Modal explicatif sur le fonctionnement
- Conseils d'utilisation pour éviter les erreurs
- Limitations de l'API Overpass
- Bouton info (ℹ️) à côté du toggle "Points d'eau"

### 6. **Fonction de nettoyage du cache**

```typescript
export function clearWaterPointsCache(): void {
  cache.clear();
  console.log('Cache des points d\'eau vidé');
}
```

Permet de vider manuellement le cache si nécessaire.

## 📊 Comparaison avant/après

| Aspect | Avant | Après |
|--------|-------|-------|
| **Debounce** | 1 seconde | 3 secondes |
| **Cache** | Aucun | 5 minutes |
| **Rate limit** | Aucun | 3s minimum |
| **Requêtes simultanées** | Possible | Bloqué |
| **Gestion erreur 429** | Crash | Fallback cache |
| **Nombre de requêtes** | ~10-20/minute | ~2-5/minute |

## 🎯 Résultats attendus

### Réduction drastique des requêtes
- **Avant :** Chaque mouvement de carte = nouvelle requête
- **Après :** Requête uniquement après 3s d'arrêt + si pas en cache

### Amélioration de l'expérience utilisateur
- ✅ Chargement plus rapide (cache)
- ✅ Pas d'erreurs visibles pour l'utilisateur
- ✅ Feedback clair en cas de problème
- ✅ Explications et conseils d'utilisation

### Respect des limites API Overpass
- ✅ Maximum 1 requête toutes les 3 secondes
- ✅ Cache de 5 minutes
- ✅ Réutilisation des requêtes en cours
- ✅ Graceful degradation en cas d'erreur

## 🧪 Tests recommandés

### 1. Test du cache
```typescript
// 1. Activer les points d'eau sur une zone
// 2. Se déplacer légèrement
// 3. Vérifier la console : "Points d'eau récupérés depuis le cache"
```

### 2. Test du rate limiting
```typescript
// 1. Activer les points d'eau
// 2. Bouger rapidement la carte plusieurs fois
// 3. Vérifier la console : "Rate limiting: attente de Xms..."
```

### 3. Test du debounce
```typescript
// 1. Bouger la carte sans s'arrêter pendant 10 secondes
// 2. Vérifier qu'aucune requête n'est faite
// 3. S'arrêter 3 secondes
// 4. Une requête doit être faite
```

### 4. Test erreur 429
```typescript
// 1. Faire plusieurs requêtes rapides pour déclencher une erreur 429
// 2. Vérifier que le message d'erreur s'affiche
// 3. Vérifier que le cache expiré est utilisé si disponible
```

## 📚 Fichiers modifiés

### Nouveaux fichiers
1. `/src/app/components/WaterPointsInfo.tsx` - Modal d'information

### Fichiers modifiés
1. `/src/app/services/overpass.ts` - Cache + Rate limiting + Gestion erreurs
2. `/src/app/components/MapView.tsx` - Debounce + Messages d'erreur
3. `/src/app/components/SearchBar.tsx` - Bouton info
4. `/src/app/App.tsx` - État et props pour modal info

## 💡 Conseils d'utilisation pour les utilisateurs

### Pour minimiser les erreurs :
1. **Zoomer** sur une zone avant d'activer les points d'eau
2. **Attendre 3 secondes** après chaque mouvement de carte
3. **Éviter** les mouvements rapides et répétés
4. **Désactiver** les points d'eau quand ils ne sont pas nécessaires

### En cas d'erreur 429 :
1. **Attendre** 10-30 secondes sans bouger la carte
2. **Désactiver** puis **réactiver** les points d'eau
3. Les **données en cache** seront toujours disponibles

## 🚀 Améliorations futures possibles

### Court terme
- [ ] Indicateur visuel du temps restant avant prochaine requête
- [ ] Bouton "Rafraîchir" manuel pour forcer le rechargement
- [ ] Préchargement des zones adjacentes

### Long terme
- [ ] Service Worker pour mise en cache persistante
- [ ] Utilisation d'une instance Overpass auto-hébergée
- [ ] API alternative (IGN, etc.)
- [ ] Base de données locale avec synchronisation périodique

## ✅ Checklist de validation

- [x] Cache de 5 minutes implémenté
- [x] Rate limiting de 3 secondes implémenté
- [x] Debounce augmenté à 3 secondes
- [x] Gestion erreur 429 avec fallback
- [x] Messages d'erreur contextuels
- [x] Indicateur de chargement
- [x] Modal d'information pour l'utilisateur
- [x] Documentation complète
- [x] Console.log pour debugging

## 🎉 Conclusion

Le système est maintenant **robuste** et **respectueux** des limites de l'API Overpass. Les erreurs 429 ne devraient plus se produire dans des conditions normales d'utilisation, et si elles surviennent, l'utilisateur aura toujours accès aux données en cache avec un message d'information clair.
