# Proxmox Control Panel

<p align="center">
  <a href="https://github.com/DavyLss/proxmox-control-panel"><img src="docs/badges/repository.svg" alt="Repository" /></a>
  <img src="docs/badges/stars.svg" alt="Stars" />
  <img src="docs/badges/forks.svg" alt="Forks" />
  <img src="docs/badges/issues.svg" alt="Open issues" />
</p>

<p align="center">
  <a href="https://github.com/DavyLss/proxmox-control-panel/actions"><img src="docs/badges/docker-build.svg" alt="Docker workflow status" /></a>
  <img src="docs/badges/default-branch.svg" alt="Default branch develop" />
  <img src="docs/badges/runtime.svg" alt="Runtime" />
  <img src="docs/badges/ui-stack.svg" alt="UI stack" />
</p>

<p align="center">
  <strong>A simpler, faster web interface for managing Proxmox VE.</strong><br/>
  See all your VMs, LXC containers, backups, and monitoring — no more clicking through 10 submenus.<br/>
  <a href="https://proxmox-control-panel.lassechere.fr/"><strong>Live Demo</strong></a>
</p>

---

## Why this project

Proxmox's native UI is great for advanced configuration… but for daily tasks (restarting a VM, checking a backup, accessing a console), it's often too low-level and too spread out.

I got tired of clicking through 3 submenus just to check a VM's status, or not having a quick overview of my entire cluster.

What this interface offers :
- One single page to see ALL your VMs and LXC containers, with quick actions
- Real-time monitoring with clean charts
- 1-click web console access
- Centralized view of backups and jobs

---

## Features

- **Dashboard** : Quick health overview of your cluster (online nodes, total CPU/RAM, machine count)
- **Guests inventory** : All your QEMU VMs and LXC containers on one single page, with filters and quick actions (start/stop/reboot/console)
- **Node pages** : Detailed status, monitoring with CPU/RAM/network charts, node shell console
- **Create workflow** : Wizard to create QEMU VMs or LXC containers, with simple and expert modes
- **Backup management** : Browse and manage your vzdump backup jobs, launch on-demand backups
- **Web console** : 1-click terminal access for nodes and guests (via xterm.js + WebSocket)

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

## Links

- **Repository** : https://github.com/DavyLss/proxmox-control-panel
- **Live demo** : https://proxmox-control-panel.lassechere.fr/
