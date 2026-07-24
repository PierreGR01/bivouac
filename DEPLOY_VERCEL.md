# Déploiement Vercel — bivouac

Guide pas-à-pas pour mettre le prototype en ligne.

## Ce qui est prêt

- `vercel.json` → config framework Vite + rewrites SPA + cache assets.
- `.gitignore` → exclut `node_modules/`, `dist/`, `.vercel/`, `.claude/`, etc.
- Les credentials Supabase (URL + anon key) sont déjà dans `utils/supabase/info.tsx`. L'anon key est publique par design, donc **aucune variable d'environnement à configurer côté Vercel** pour faire tourner le proto.

## Voie A — CLI Vercel (le plus rapide, sans passer par Git)

Dans un terminal, à la racine du projet `bivouac/` :

```bash
# 1. Installer le CLI Vercel (une seule fois)
npm install -g vercel

# 2. Se connecter à ton compte
vercel login

# 3. Déployer en preview (URL temporaire, idéal pour tester)
vercel

# Réponses à donner :
#   Set up and deploy? → Y
#   Which scope? → ton compte perso (ou ton équipe Camptocamp si tu veux)
#   Link to existing project? → N
#   Project name? → bivouac (ou ce que tu veux)
#   Directory? → ./ (entrée pour valider)
#   Modify settings? → N (le vercel.json fait le boulot)

# 4. Déployer en production (URL stable bivouac-xxx.vercel.app)
vercel --prod
```

Vercel va builder dans le cloud (`npm run build`) et te rendre une URL `https://bivouac-xxx.vercel.app`.

## Voie B — Via GitHub (recommandée si tu veux des déploiements continus)

```bash
# 1. Initialiser le repo Git
cd bivouac/
git init
git add .
git commit -m "Initial bivouac prototype"

# 2. Créer un repo sur github.com (privé ou public, au choix)
#    → puis lier le local au remote :
git remote add origin https://github.com/<ton-user>/bivouac.git
git branch -M main
git push -u origin main
```

Ensuite sur **vercel.com** :

1. **Add New → Project**
2. Sélectionne ton repo `bivouac`
3. Vercel détecte automatiquement Vite (grâce au `vercel.json`)
4. Clique **Deploy**

À chaque `git push` sur `main`, Vercel redéploiera automatiquement.

## Checklist post-déploiement

Une fois en ligne, vérifier :

- L'URL `https://bivouac-xxx.vercel.app` charge bien la home.
- Le rafraîchissement sur une route profonde (ex. `/map`) ne renvoie pas un 404 — sinon le rewrite SPA n'est pas pris en compte.
- La carte Leaflet s'affiche, les tuiles chargent.
- Les appels Supabase fonctionnent (ouvrir la console réseau, regarder les `fetch` vers `https://fdzcdmyehllqvofysgdf.supabase.co/...`).
- Les Edge Functions Supabase (`supabase/functions/make-server-e51cba93/`) sont déployées séparément via :
  ```bash
  npx supabase functions deploy make-server-e51cba93
  ```
  (à faire **uniquement** si tu n'as pas encore déployé tes functions, ou si tu en as modifié.)

## CORS Supabase

Si tu vois des erreurs CORS dans la console après déploiement :

1. Aller sur **app.supabase.com** → projet `fdzcdmyehllqvofysgdf`
2. **Settings → API → CORS**
3. Ajouter ton URL Vercel (`https://bivouac-xxx.vercel.app`) à l'allowlist.

## Domaine custom (optionnel)

Sur Vercel : **Project Settings → Domains → Add Domain**. Vercel te donne les enregistrements DNS à configurer chez ton registrar.

## Coûts

Tout cela reste sur le **plan Hobby gratuit** de Vercel tant que :
- Usage strictement perso / non-commercial
- < 100 GB de bande passante/mois
- < 6000 minutes de build/mois

Largement suffisant pour un proto.
