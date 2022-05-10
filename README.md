# Proxmox Control Panel

<p align="center">
  <img src="https://img.shields.io/github/stars/DavyLss/proxmox-control-panel?style=flat-square" alt="stars" />
  <img src="https://img.shields.io/github/last-commit/DavyLss/proxmox-control-panel?style=flat-square" alt="last commit" />
  <img src="https://img.shields.io/github/actions/workflow/status/DavyLss/proxmox-control-panel/docker-image.yml?branch=develop&style=flat-square" alt="docker workflow" />
  <img src="https://img.shields.io/badge/runtime-React%20%2B%20TanStack%20Start-2b2b2b?style=flat-square" alt="runtime" />
  <img src="https://img.shields.io/badge/deploy-Docker%20%2F%20GHCR-2b2b2b?style=flat-square" alt="deploy" />
</p>

<p align="center"><strong>Modern Proxmox VE control panel for nodes, VMs, LXC containers, backups, monitoring, and console access.</strong><br/>
<strong>Interface moderne pour piloter Proxmox VE : nœuds, VMs, conteneurs LXC, sauvegardes, monitoring et accès console.</strong></p>

---

## Quick facts / Faits rapides

- **Frontend:** React + TanStack Start + Vite  
  **Frontend :** React + TanStack Start + Vite
- **UI:** shadcn/ui + Tailwind CSS  
  **UI :** shadcn/ui + Tailwind CSS
- **Runtime used in deployment:** Docker container running `npm run start` (`vite dev --host 0.0.0.0 --port 8080`)  
  **Runtime utilisé en déploiement :** conteneur Docker exécutant `npm run start` (`vite dev --host 0.0.0.0 --port 8080`)
- **Distribution:** GHCR image + Docker Compose  
  **Distribution :** image GHCR + Docker Compose
- **Target:** Proxmox VE environments exposed through HTTPS / Cloudflare  
  **Cible :** environnements Proxmox VE exposés en HTTPS / Cloudflare

---

## Highlights / Points forts

- Browse **nodes**, **VMs**, and **LXC containers** from one interface.  
  Parcourez les **nœuds**, **VMs** et **conteneurs LXC** depuis une seule interface.
- View **dashboard metrics** and **monitoring charts** for nodes and guests.  
  Consultez des **métriques de dashboard** et des **graphiques de monitoring** pour les nœuds et les machines.
- Create **QEMU VMs** and **LXC containers** from the UI.  
  Créez des **VMs QEMU** et des **conteneurs LXC** depuis l’interface.
- Open **web consoles** for nodes, VMs, and LXC guests.  
  Ouvrez des **consoles web** pour les nœuds, VMs et conteneurs LXC.
- Manage and inspect **backup jobs** and guest backups.  
  Gérez et consultez les **tâches de sauvegarde** et les sauvegardes des machines.
- Works with a **Cloudflare fronted Proxmox endpoint**, including CORS/WebSocket adjustments when required.  
  Fonctionne avec un **endpoint Proxmox exposé via Cloudflare**, y compris les ajustements CORS/WebSocket si nécessaire.

---

## Main sections / Sections principales

- **Dashboard / Vue d’ensemble**  
  Global visibility on nodes and infrastructure status.
- **Machines**  
  Guest inventory with quick access to details and console.
- **Nodes / Nœuds**  
  Node-level status, monitoring, console, and backup jobs.
- **Create / Créer**  
  Create QEMU VMs and LXC containers.
- **Backups / Sauvegardes**  
  Review backup storage and scheduled backup jobs.

---

## Install & run / Installation et exécution

### Option 1 — Run with Docker Compose / Lancer avec Docker Compose

```bash
git clone https://github.com/DavyLss/proxmox-control-panel.git
cd proxmox-control-panel
cp .env.example .env 2>/dev/null || true

docker compose up -d --build
```

The app is expected on port `8080`.  
L’application est prévue sur le port `8080`.

If you deploy from GHCR, `docker-compose.yml` already supports:

```yaml
image: ghcr.io/davylss/proxmox-control-panel:${IMAGE_TAG:-develop}
```

### Option 2 — Local development / Développement local

```bash
git clone https://github.com/DavyLss/proxmox-control-panel.git
cd proxmox-control-panel
npm install
npm run build
npm run start
```

Then open: `http://localhost:8080`  
Puis ouvrez : `http://localhost:8080`

---

## Build & publish image / Construire et publier l’image

A GitHub Actions workflow builds and pushes the image to **GHCR** on pushes to:

- `main`
- `develop`

Workflow file:

- `.github/workflows/docker-image.yml`

Published image:

- `ghcr.io/davylss/proxmox-control-panel`

---

## Deployment pattern / Pattern de déploiement

This repository is designed to fit a simple target-host pattern:

- repository cloned in `/opt/proxmox-control-panel`
- local deployment script on the target host/container
- update with `git fetch` + `git reset --hard origin/develop`
- deploy with `docker compose up -d --build`

Pattern recommandé :

- dépôt cloné dans `/opt/proxmox-control-panel`
- script de déploiement local sur l’hôte/conteneur cible
- mise à jour avec `git fetch` + `git reset --hard origin/develop`
- déploiement via `docker compose up -d --build`

Example local deploy script logic:

```bash
git fetch origin develop
git checkout develop
git reset --hard origin/develop
[ -f .env ] || printf 'IMAGE_TAG=develop\n' > .env
docker compose pull --ignore-buildable || true
docker compose up -d --build --remove-orphans
```

---

## Cloudflare & Proxmox prerequisites / Prérequis Cloudflare & Proxmox

This project can work behind Cloudflare, but **console access and direct API login require a clean cross-origin setup**.

Ce projet peut fonctionner derrière Cloudflare, mais **l’accès console et la connexion API directe exigent une configuration cross-origin propre**.

### 1) Proxmox endpoint must be reachable in HTTPS

Example:

- `https://iaas.ilteam.fr`

The certificate must be valid from the browser point of view.  
Le certificat doit être valide du point de vue du navigateur.

### 2) Allowed host on the app side / Hôte autorisé côté app

If the app is exposed through Cloudflare, add the public hostname in `vite.config.ts`:

```ts
vite: {
  server: {
    allowedHosts: ["proxmox-control-panel.lassechere.fr"],
  },
}
```

Without this, Vite may reject the public hostname.  
Sinon, Vite peut refuser le hostname public.

### 3) CORS for `/api2/*`

If Proxmox is accessed from the browser through a different origin than the app, the API path must allow the app origin.

If using Cloudflare in front of Proxmox, ensure responses for `https://iaas.ilteam.fr/api2/*` expose at least:

- `Access-Control-Allow-Origin: https://proxmox-control-panel.lassechere.fr`
- `Access-Control-Allow-Credentials: true`
- `Access-Control-Allow-Headers: Content-Type, CSRFPreventionToken, Authorization`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Expose-Headers: CSRFPreventionToken`

### 4) Cloudflare Worker for API and console / Worker Cloudflare pour API et console

In the current working setup, a Cloudflare Worker is attached to:

- route: `iaas.ilteam.fr/api2/*`
- script: `cors-proxmox-api`

Its responsibilities are:

- answer CORS preflight requests
- return the correct `Access-Control-Allow-Origin`
- preserve websocket upgrades
- rewrite Proxmox cookies for browser compatibility when needed
- inject `PVEAuthCookie` for websocket console access when the console URL carries `pveauthcookie`

If you reproduce this project on another domain, adapt the allowed origins list in that worker.

### 5) Console/WebSocket requirements / Pré requis console/WebSocket

For web console access to work reliably:

- the Proxmox API route must support **WebSocket upgrades**
- Cloudflare must not block websocket traffic on `/api2/*`
- the authentication cookie/ticket must be forwarded to Proxmox for `vncwebsocket`
- QEMU guests may require `serial0: socket` for xterm-based console usage
- the guest or node must be running

### 6) Permissions / Permissions Proxmox

The connected Proxmox user must have the appropriate privileges, for example:

- `Sys.Console` for node console access
- guest access rights required by `termproxy` / `vncwebsocket`
- backup permissions where backup screens are used

---

## Authentication model / Modèle d’authentification

The app authenticates against Proxmox and stores the Proxmox ticket in browser storage.

L’application s’authentifie auprès de Proxmox et stocke le ticket Proxmox dans le navigateur.

Important points:

- the ticket is restored client-side on reload
- the ticket is auto-refreshed periodically
- login can require TOTP / recovery code when Proxmox 2FA is enabled
- no credentials should be committed to the repository

---

## Runtime notes / Notes d’exécution

At the time of this setup, the containerized runtime validated in production is:

```bash
npm run start
```

which currently maps to:

```bash
vite dev --host 0.0.0.0 --port 8080
```

A standalone SSR Node runtime was not the validated path for this deployment.  
Un runtime SSR Node autonome n’a pas été le chemin validé pour ce déploiement.

---

## Project structure / Structure du projet

```text
src/
  components/            # UI + Proxmox widgets
  lib/proxmox/           # API client, auth, console helpers
  routes/                # TanStack file-based routes
.github/workflows/       # Docker build/push workflow
Dockerfile               # Container image build
/docker-compose.yml      # Local/target deployment
vite.config.ts           # Vite + allowedHosts config
```

---

## Useful commands / Commandes utiles

```bash
# Install deps / Installer les dépendances
npm install

# Build / Compiler
npm run build

# Start locally / Démarrer localement
npm run start

# Lint
npm run lint

# Format
npm run format
```

Note: the repository may contain historical formatting issues unrelated to deployment validity.  
Note : le dépôt peut contenir des écarts de formatage historiques sans impact sur le déploiement.

---

## Troubleshooting / Dépannage

### Login works but API says `Failed to fetch`

Most likely causes:

- wrong CORS origin
- Cloudflare worker not updated for the app hostname
- invalid or blocked HTTPS endpoint

### Login loops between `/login` and `/dashboard`

This usually means auth restoration is not complete before redirect logic runs.  
Cela signifie généralement que la restauration de session n’est pas terminée avant la redirection.

### Console opens but stays blank / La console s’ouvre mais reste vide

Check:

- websocket upgrade support on `/api2/*`
- Cloudflare worker handling for console websocket
- Proxmox user privileges
- `serial0: socket` for QEMU where needed
- guest/node is running

### Public hostname is blocked by Vite

Add the hostname to `vite.server.allowedHosts` in `vite.config.ts`.

---

## Security notes / Notes de sécurité

- Do not store durable credentials in the repository.  
  Ne stockez pas de secrets durables dans le dépôt.
- Prefer Proxmox accounts/tokens with only the permissions needed.  
  Préférez des comptes/tokens Proxmox limités au strict nécessaire.
- If exposed through Cloudflare, review Worker behavior carefully because it can affect CORS, cookies, and websocket authentication.  
  Si l’application est exposée via Cloudflare, relisez attentivement le comportement du Worker car il peut impacter CORS, cookies et authentification websocket.

---

## Roadmap ideas / Idées d’évolution

- automatic deployment workflow to the target LXC on push to `develop`
- stronger same-origin proxy mode for Proxmox API access
- hardened production runtime beyond current `vite dev` compatibility mode
- better console diagnostics in the UI

---

## Repository / Dépôt

- GitHub: `DavyLss/proxmox-control-panel`
- Main public app example: `https://proxmox-control-panel.lassechere.fr/`

If you adapt it for another environment, review both the deployment and Cloudflare sections first.  
Si vous l’adaptez à un autre environnement, commencez par revoir les sections déploiement et Cloudflare.
