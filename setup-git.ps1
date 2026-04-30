# Script d'init git pour le projet bivouac
# A executer depuis PowerShell, dans le dossier bivouac/
#
# Usage :
#   1. Ouvrir PowerShell
#   2. cd "C:\Users\Pierre Grambert\Pictures\bivouac\bivouac"
#   3. .\setup-git.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Setup git pour bivouac ===" -ForegroundColor Cyan

# 0. Verifier qu'on est au bon endroit
if (-not (Test-Path "package.json")) {
    Write-Host "ERREUR : package.json introuvable. Lance ce script depuis le dossier bivouac/" -ForegroundColor Red
    exit 1
}

# 1. Nettoyer un eventuel .git corrompu (laisse par le sandbox)
if (Test-Path ".git") {
    Write-Host "Suppression de l'ancien .git/ (corrompu par le sandbox)..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force ".git"
}

# 2. Init git avec branche main
Write-Host "Initialisation du repo git..." -ForegroundColor Cyan
git init -b main

# 3. Config user (a adapter si besoin)
git config user.email "pierre.grambert@camptocamp.com"
git config user.name "Pierre Grambert"

# 4. Premier commit
Write-Host "Premier commit..." -ForegroundColor Cyan
git add .
git status --short | Select-Object -First 10
git commit -m "Initial bivouac prototype"

# 5. Resume
Write-Host ""
Write-Host "=== OK ! Repo local pret ===" -ForegroundColor Green
Write-Host ""
Write-Host "Etapes suivantes :" -ForegroundColor Yellow
Write-Host "  1. Va sur https://github.com/new"
Write-Host "  2. Nom du repo : bivouac (privé)"
Write-Host "  3. NE COCHE PAS 'Initialize with README'"
Write-Host "  4. Clique 'Create repository'"
Write-Host "  5. GitHub te montrera une URL du type https://github.com/<TON_USER>/bivouac.git"
Write-Host "  6. Reviens ici et lance :"
Write-Host ""
Write-Host "     git remote add origin https://github.com/<TON_USER>/bivouac.git" -ForegroundColor Cyan
Write-Host "     git push -u origin main" -ForegroundColor Cyan
Write-Host ""
Write-Host "  7. Puis va sur https://vercel.com/new et importe le repo bivouac"
Write-Host ""
