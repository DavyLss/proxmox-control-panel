# Proxmox Control Panel

<p align="center">
  <a href="https://github.com/DavyLss/proxmox-control-panel/stargazers"><img src="https://img.shields.io/github/stars/DavyLss/proxmox-control-panel?style=for-the-badge" alt="GitHub stars" /></a>
  <a href="https://github.com/DavyLss/proxmox-control-panel/network/members"><img src="https://img.shields.io/github/forks/DavyLss/proxmox-control-panel?style=for-the-badge" alt="GitHub forks" /></a>
  <a href="https://github.com/DavyLss/proxmox-control-panel/issues"><img src="https://img.shields.io/github/issues/DavyLss/proxmox-control-panel?style=for-the-badge" alt="GitHub issues" /></a>
  <a href="https://github.com/DavyLss/proxmox-control-panel/commits/develop/"><img src="https://img.shields.io/github/last-commit/DavyLss/proxmox-control-panel/develop?style=for-the-badge" alt="Last commit (develop)" /></a>
</p>

<p align="center">
  <a href="https://github.com/DavyLss/proxmox-control-panel/actions/workflows/docker-image.yml"><img src="https://img.shields.io/github/actions/workflow/status/DavyLss/proxmox-control-panel/docker-image.yml?branch=develop&style=for-the-badge&label=Docker%20Build" alt="Docker workflow status" /></a>
  <a href="https://github.com/DavyLss/proxmox-control-panel/pkgs/container/proxmox-control-panel"><img src="https://img.shields.io/badge/GHCR-ghcr.io%2Fdavylss%2Fproxmox--control--panel-2ea44f?style=for-the-badge" alt="GHCR image" /></a>
  <img src="https://img.shields.io/badge/Branch-develop-blue?style=for-the-badge" alt="Default branch develop" />
  <img src="https://img.shields.io/badge/Stack-React%20%2B%20TanStack%20Start%20%2B%20TypeScript-111827?style=for-the-badge" alt="Tech stack" />
</p>

<p align="center">
  <strong>A modern web control panel for Proxmox VE.</strong><br/>
  Manage nodes, VMs, LXC containers, backups, monitoring, and console access from one UI.
</p>

---

## Why this project

Proxmox is powerful, but daily operations often require jumping across multiple pages and low-level views.
This project gives you a cleaner operator experience for common tasks:

- infrastructure overview
- guest lifecycle and quick actions
- charts and node metrics
- backup visibility
- web console access

---

## Features

- **Dashboard:** global health snapshot of your Proxmox estate
- **Guests inventory:** VMs + LXCs in one place
- **Node pages:** status, resources, and monitoring charts
- **Create workflows:** create QEMU VMs and LXC containers
- **Backups:** browse backup jobs and storage data
- **Console access:** node/guest console helpers through Proxmox API routes

---

## Project widgets

These widgets are pinned to the **develop** branch and active workflow:

- Docker build status (GitHub Actions)
- Last commit on develop
- Issues / stars / forks
- GHCR image reference

> If a widget looks stale, GitHub/Shield cache can take a few minutes to refresh.

---

## Screenshots

### Dashboard
![Dashboard](docs/images/dashboard.jpg)

### Guests list
![Guests list](docs/images/guests-list.jpg)

### Node monitoring
![Node monitoring](docs/images/node-monitoring.jpg)

### Create LXC
![Create LXC](docs/images/create-lxc.jpg)

### Create QEMU VM
![Create QEMU VM](docs/images/create-qemu.jpg)

### Backups
![Backups](docs/images/backups.jpg)

---

## Quick start

### 1) Clone

```bash
git clone https://github.com/DavyLss/proxmox-control-panel.git
cd proxmox-control-panel
git checkout develop
```

### 2) Run with Docker Compose

```bash
docker compose up -d --build
```

App URL (default): `http://localhost:8080`

### 3) Local dev mode

```bash
npm install
npm run build
npm run start
```

---

## Docker image (GHCR)

Image is published to:

- `ghcr.io/davylss/proxmox-control-panel`

Example compose reference:

```yaml
services:
  proxmox-control-panel:
    image: ghcr.io/davylss/proxmox-control-panel:${IMAGE_TAG:-develop}
    ports:
      - "8080:8080"
```

---

## Deployment model

Recommended target-host pattern:

- clone repo in `/opt/proxmox-control-panel`
- track only `develop`
- update with hard reset
- redeploy with Docker Compose

Example:

```bash
git fetch origin develop
git checkout develop
git reset --hard origin/develop
docker compose pull --ignore-buildable || true
docker compose up -d --build --remove-orphans
```

---

## Proxmox + Cloudflare prerequisites

For stable API + console behavior behind Cloudflare:

1. Proxmox endpoint reachable in HTTPS
2. frontend hostname allowed in `vite.config.ts` (`server.allowedHosts`)
3. CORS headers correctly returned on `/api2/*`
4. WebSocket upgrades preserved for console routes
5. auth ticket/cookie compatibility handled end-to-end

If you route Proxmox through a Cloudflare Worker, ensure it handles:

- preflight (`OPTIONS`)
- origin-aware CORS
- websocket upgrade passthrough
- cookie forwarding/rewriting compatibility for console paths

---

## Authentication notes

- Login uses Proxmox authentication endpoints
- Ticket/session is restored client-side on reload
- Auto-refresh is used to keep sessions valid
- TOTP/recovery support works when Proxmox 2FA is enabled

---

## Tech stack

- **Frontend:** React 19 + TypeScript
- **App framework:** TanStack Start + TanStack Router
- **Build:** Vite
- **UI:** shadcn/ui + Tailwind CSS + Radix UI
- **Charts:** Recharts
- **Container:** Docker
- **Registry:** GHCR

---

## Project structure

```text
src/
  components/            # UI + Proxmox widgets
  lib/proxmox/           # API client, auth, console helpers
  routes/                # TanStack file-based routes
.github/workflows/       # CI workflows
Dockerfile               # Container image build
/docker-compose.yml      # Local/target deployment
vite.config.ts           # Vite + host allowlist
```

---

## Useful commands

```bash
npm install
npm run build
npm run start
npm run lint
npm run format
```

---

## Troubleshooting

### `Failed to fetch` after login

Usually CORS/origin mismatch on Proxmox API routes.

### Console opens but stays blank

Check websocket upgrade path, cookie forwarding, Proxmox permissions, and guest/node running state.

### Public hostname blocked

Add the hostname to `vite.server.allowedHosts` in `vite.config.ts`.

---

## Security recommendations

- Do not commit long-lived credentials/secrets
- Use least-privilege Proxmox accounts/tokens
- Review Cloudflare Worker behavior carefully when handling auth/cookies

---

## Branch policy

- **Default branch:** `develop`
- **Production updates:** from validated commits on `develop`
- **Deleted branch:** `main`

---

## Repository

- GitHub: https://github.com/DavyLss/proxmox-control-panel
- Example deployment URL: https://proxmox-control-panel.lassechere.fr/

If you want, next step I can also add:

- contribution guide (`CONTRIBUTING.md`)
- issue/PR templates
- release notes template
- architecture diagram (Mermaid)
