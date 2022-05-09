/**
 * Minimal Proxmox VE API client (browser-side).
 * Self-hosted use: the browser talks directly to https://<proxmox>:8006.
 * Proxmox must allow CORS for the app's origin (or be reverse-proxied
 * under the same origin).
 */

import { proxmoxApiProxy } from "./proxy.functions";

export interface ProxmoxCredentials {
  baseUrl: string; // e.g. https://pve.local:8006
  username: string; // e.g. root
  realm: string; // pam | pve
  password: string;
}

export interface ProxmoxTicket {
  baseUrl: string;
  username: string; // user@realm
  ticket: string;
  CSRFPreventionToken: string;
  obtainedAt: number;
}

export interface ProxmoxTfaChallenge {
  baseUrl: string;
  username: string;
  partialTicket: string;
  CSRFPreventionToken: string;
  types: { totp?: boolean; recovery?: boolean; webauthn?: boolean; yubico?: boolean };
}

export type LoginResult =
  | { kind: "ok"; ticket: ProxmoxTicket }
  | { kind: "tfa"; challenge: ProxmoxTfaChallenge };

const TICKET_TTL_MS = 1000 * 60 * 60 * 1.5; // Proxmox tickets last ~2h

export function isTicketValid(t: ProxmoxTicket | null): t is ProxmoxTicket {
  return !!t && Date.now() - t.obtainedAt < TICKET_TTL_MS;
}

function trimUrl(u: string) {
  return u.replace(/\/+$/, "");
}

export async function login(c: ProxmoxCredentials): Promise<LoginResult> {
  const baseUrl = trimUrl(c.baseUrl);
  const body = new URLSearchParams({
    username: `${c.username}@${c.realm}`,
    password: c.password,
  });

  const res = await fetch(`${baseUrl}/api2/json/access/ticket`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    credentials: "include",
  }).catch((e) => {
    throw new Error(
      `Impossible de joindre ${baseUrl}. Acceptez d'abord le certificat TLS dans votre navigateur (ouvrez l'URL directement) et vérifiez la configuration CORS de Proxmox. Détail: ${e instanceof Error ? e.message : String(e)}`,
    );
  });

  if (!res.ok) {
    throw new Error(
      `Échec de l'authentification (${res.status}). Vérifiez l'URL, les identifiants et le realm.`,
    );
  }
  const json = (await res.json()) as {
    data: {
      ticket: string;
      CSRFPreventionToken: string;
      username: string;
      NeedTFA?: number;
      "tfa-challenge"?: string;
    };
  };
  if (json.data.NeedTFA === 1 || json.data.ticket?.startsWith("PVE:")) {
    let types: ProxmoxTfaChallenge["types"] = { totp: true };
    const challenge = json.data["tfa-challenge"];
    if (challenge) {
      try {
        const payload = JSON.parse(atob(challenge.split(":")[1] ?? "")) as Record<string, unknown>;
        types = {
          totp: !!payload.totp,
          recovery: !!payload.recovery,
          webauthn: !!payload.webauthn,
          yubico: !!payload.yubico,
        };
      } catch { /* ignore */ }
    }
    return {
      kind: "tfa",
      challenge: {
        baseUrl,
        username: json.data.username,
        partialTicket: json.data.ticket,
        CSRFPreventionToken: json.data.CSRFPreventionToken,
        types,
      },
    };
  }
  return {
    kind: "ok",
    ticket: {
      baseUrl,
      username: json.data.username,
      ticket: json.data.ticket,
      CSRFPreventionToken: json.data.CSRFPreventionToken,
      obtainedAt: Date.now(),
    },
  };
}

export async function loginTfa(
  c: ProxmoxTfaChallenge,
  code: string,
  kind: "totp" | "recovery" = "totp",
): Promise<ProxmoxTicket> {
  const body = new URLSearchParams({
    username: c.username,
    "tfa-challenge": c.partialTicket,
    password: `${kind}:${code}`,
  });
  const res = await fetch(`${c.baseUrl}/api2/json/access/ticket`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      CSRFPreventionToken: c.CSRFPreventionToken,
    },
    body,
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Code 2FA invalide (${res.status}).`);
  const json = (await res.json()) as {
    data: { ticket: string; CSRFPreventionToken: string; username: string };
  };
  return {
    baseUrl: c.baseUrl,
    username: json.data.username,
    ticket: json.data.ticket,
    CSRFPreventionToken: json.data.CSRFPreventionToken,
    obtainedAt: Date.now(),
  };
}

type RequestOpts = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: Record<string, unknown>;
};

export async function api<T = unknown>(
  t: ProxmoxTicket,
  path: string,
  opts: RequestOpts = {},
): Promise<T> {
  const method = opts.method ?? "GET";

  if (method === "POST" && /\/nodes\/[^/]+(?:\/(qemu|lxc)\/\d+)?\/termproxy$/.test(path)) {
    const guestMatch = path.match(/^\/nodes\/([^/]+)\/(qemu|lxc)\/(\d+)\/termproxy$/);
    const nodeMatch = path.match(/^\/nodes\/([^/]+)\/termproxy$/);
    let referer: string | undefined;
    if (guestMatch) {
      referer = `${t.baseUrl}/?console=${guestMatch[2] === "qemu" ? "kvm" : "lxc"}&xtermjs=1&vmid=${guestMatch[3]}&node=${encodeURIComponent(guestMatch[1])}&cmd=`;
    } else if (nodeMatch) {
      referer = `${t.baseUrl}/?console=shell&xtermjs=1&node=${encodeURIComponent(nodeMatch[1])}`;
    }
    return proxmoxApiProxy({
      data: {
        ticket: t,
        path,
        referer,
      },
    }) as Promise<T>;
  }

  const headers: Record<string, string> = {
    Authorization: `PVEAuthCookie=${t.ticket}`,
  };
  // Browser JavaScript cannot set Cookie headers. Use Authorization instead.

  let body: BodyInit | undefined;
  if (opts.body && method !== "GET") {
    headers["CSRFPreventionToken"] = t.CSRFPreventionToken;
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.body)) {
      if (v === undefined || v === null) continue;
      params.append(k, String(v));
    }
    body = params;
  }

  const res = await fetch(`${t.baseUrl}/api2/json${path}`, {
    method,
    headers,
    body,
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Proxmox API ${method} ${path} → ${res.status} ${text}`);
  }
  const json = (await res.json()) as { data: T };
  return json.data;
}

/* ---------- Typed helpers ---------- */

export interface PveNode {
  node: string;
  status: "online" | "offline" | "unknown";
  cpu?: number;
  maxcpu?: number;
  mem?: number;
  maxmem?: number;
  uptime?: number;
  level?: string;
}

export interface PveGuest {
  vmid: number;
  name?: string;
  status: "running" | "stopped" | "paused" | string;
  type: "qemu" | "lxc";
  node: string;
  cpu?: number;
  maxcpu?: number;
  mem?: number;
  maxmem?: number;
  uptime?: number;
  template?: number;
}

export async function listNodes(t: ProxmoxTicket): Promise<PveNode[]> {
  return api<PveNode[]>(t, "/nodes");
}

export async function listAllGuests(t: ProxmoxTicket): Promise<PveGuest[]> {
  const resources = await api<
    Array<{
      type: string;
      vmid?: number;
      name?: string;
      status?: string;
      node?: string;
      cpu?: number;
      maxcpu?: number;
      mem?: number;
      maxmem?: number;
      uptime?: number;
      template?: number;
    }>
  >(t, "/cluster/resources?type=vm");
  return resources
    .filter((r) => r.type === "qemu" || r.type === "lxc")
    .map((r) => ({
      vmid: r.vmid!,
      name: r.name,
      status: (r.status as PveGuest["status"]) ?? "unknown",
      type: r.type as "qemu" | "lxc",
      node: r.node!,
      cpu: r.cpu,
      maxcpu: r.maxcpu,
      mem: r.mem,
      maxmem: r.maxmem,
      uptime: r.uptime,
      template: r.template,
    }));
}

export async function guestAction(
  t: ProxmoxTicket,
  g: { node: string; type: "qemu" | "lxc"; vmid: number },
  action: "start" | "stop" | "shutdown" | "reboot" | "reset" | "suspend" | "resume",
) {
  return api(t, `/nodes/${g.node}/${g.type}/${g.vmid}/status/${action}`, {
    method: "POST",
  });
}

export async function guestStatus(
  t: ProxmoxTicket,
  g: { node: string; type: "qemu" | "lxc"; vmid: number },
) {
  return api<Record<string, unknown>>(
    t,
    `/nodes/${g.node}/${g.type}/${g.vmid}/status/current`,
  );
}

export async function guestRrd(
  t: ProxmoxTicket,
  g: { node: string; type: "qemu" | "lxc"; vmid: number },
  timeframe: "hour" | "day" | "week" = "hour",
) {
  return api<
    Array<{
      time: number;
      cpu?: number;
      mem?: number;
      maxmem?: number;
      netin?: number;
      netout?: number;
      diskread?: number;
      diskwrite?: number;
    }>
  >(t, `/nodes/${g.node}/${g.type}/${g.vmid}/rrddata?timeframe=${timeframe}&cf=AVERAGE`);
}

export async function nextVmid(t: ProxmoxTicket): Promise<number> {
  const v = await api<string>(t, "/cluster/nextid");
  return Number(v);
}

export async function listStorage(t: ProxmoxTicket, node: string) {
  return api<Array<{ storage: string; type: string; content: string }>>(
    t,
    `/nodes/${node}/storage`,
  );
}

export async function listIso(t: ProxmoxTicket, node: string, storage: string) {
  return api<Array<{ volid: string; size?: number }>>(
    t,
    `/nodes/${node}/storage/${storage}/content?content=iso`,
  );
}

export async function listTemplates(t: ProxmoxTicket, node: string, storage: string) {
  return api<Array<{ volid: string; size?: number }>>(
    t,
    `/nodes/${node}/storage/${storage}/content?content=vztmpl`,
  );
}

export async function createQemu(
  t: ProxmoxTicket,
  node: string,
  payload: Record<string, unknown>,
) {
  return api(t, `/nodes/${node}/qemu`, { method: "POST", body: payload });
}

export async function createLxc(
  t: ProxmoxTicket,
  node: string,
  payload: Record<string, unknown>,
) {
  return api(t, `/nodes/${node}/lxc`, { method: "POST", body: payload });
}

/**
 * Open a websocket terminal (xterm proxy) for a VM/LXC.
 * Returns the WebSocket and the term metadata you must wire to xterm.js.
 */
export async function openTermProxy(
  t: ProxmoxTicket,
  g: { node: string; type: "qemu" | "lxc"; vmid: number },
) {
  const data = await api<{ ticket: string; port: string | number; user: string }>(
    t,
    `/nodes/${g.node}/${g.type}/${g.vmid}/termproxy`,
    { method: "POST" },
  );
  const params = new URLSearchParams({
    baseUrl: t.baseUrl,
    username: data.user ?? t.username,
    ticket: t.ticket,
    node: g.node,
    type: g.type,
    vmid: String(g.vmid),
    port: String(data.port),
    vncticket: data.ticket,
  });
  const wsUrl = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/api/proxmox/console?${params.toString()}`;
  return { wsUrl, vncticket: data.ticket, user: data.user ?? t.username };
}

export async function openNodeTermProxy(t: ProxmoxTicket, node: string) {
  const data = await api<{ ticket: string; port: string | number; user: string }>(
    t,
    `/nodes/${node}/termproxy`,
    { method: "POST" },
  );
  const params = new URLSearchParams({
    baseUrl: t.baseUrl,
    username: data.user ?? t.username,
    ticket: t.ticket,
    node,
    port: String(data.port),
    vncticket: data.ticket,
  });
  const wsUrl = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/api/proxmox/console?${params.toString()}`;
  return { wsUrl, vncticket: data.ticket, user: data.user ?? t.username };
}

/* ---------- Node helpers ---------- */

export async function nodeStatus(t: ProxmoxTicket, node: string) {
  return api<{
    cpu?: number;
    cpuinfo?: { cpus?: number; model?: string };
    loadavg?: string[];
    memory?: { total?: number; used?: number; free?: number };
    rootfs?: { total?: number; used?: number };
    swap?: { total?: number; used?: number };
    uptime?: number;
    kversion?: string;
    pveversion?: string;
  }>(t, `/nodes/${node}/status`);
}

export async function nodeRrd(
  t: ProxmoxTicket,
  node: string,
  timeframe: "hour" | "day" | "week" = "hour",
) {
  return api<
    Array<{
      time: number;
      cpu?: number;
      memused?: number;
      memtotal?: number;
      netin?: number;
      netout?: number;
      loadavg?: number;
      iowait?: number;
      rootused?: number;
      roottotal?: number;
    }>
  >(t, `/nodes/${node}/rrddata?timeframe=${timeframe}&cf=AVERAGE`);
}

export async function getPermissions(t: ProxmoxTicket) {
  return api<Record<string, Record<string, number>>>(t, `/access/permissions`);
}

export function hasPermission(
  perms: Record<string, Record<string, number>> | undefined,
  path: string,
  privilege: string,
) {
  if (!perms) return false;
  const segments = path.split("/").filter(Boolean);
  const candidates = ["/", ...segments.map((_, i) => "/" + segments.slice(0, i + 1).join("/"))];
  for (const c of candidates) {
    if (perms[c]?.[privilege]) return true;
  }
  return false;
}

/* ---------- QEMU config ---------- */

export async function getQemuConfig(
  t: ProxmoxTicket,
  node: string,
  vmid: number,
) {
  return api<Record<string, unknown>>(t, `/nodes/${node}/qemu/${vmid}/config`);
}

export async function setQemuConfig(
  t: ProxmoxTicket,
  node: string,
  vmid: number,
  payload: Record<string, unknown>,
) {
  return api(t, `/nodes/${node}/qemu/${vmid}/config`, {
    method: "POST",
    body: payload,
  });
}

/* ---------- Backups ---------- */

export interface BackupVolume {
  volid: string;
  size?: number;
  ctime?: number;
  vmid?: number;
  format?: string;
  notes?: string;
}

export async function listBackups(
  t: ProxmoxTicket,
  node: string,
  storage: string,
  vmid?: number,
) {
  const q = vmid ? `&vmid=${vmid}` : "";
  return api<BackupVolume[]>(
    t,
    `/nodes/${node}/storage/${storage}/content?content=backup${q}`,
  );
}

export async function listBackupStorages(t: ProxmoxTicket, node: string) {
  const all = await listStorage(t, node);
  return all.filter((s) => s.content.includes("backup"));
}

export async function vzdumpNow(
  t: ProxmoxTicket,
  node: string,
  payload: {
    vmid: number;
    storage: string;
    mode?: "snapshot" | "suspend" | "stop";
    compress?: "0" | "lzo" | "gzip" | "zstd";
    notes?: string;
    remove?: 0 | 1;
  },
) {
  return api(t, `/nodes/${node}/vzdump`, {
    method: "POST",
    body: {
      mode: "snapshot",
      compress: "zstd",
      ...payload,
    },
  });
}

export async function deleteBackup(
  t: ProxmoxTicket,
  node: string,
  storage: string,
  volid: string,
) {
  return api(
    t,
    `/nodes/${node}/storage/${storage}/content/${encodeURIComponent(volid)}`,
    { method: "DELETE" },
  );
}

export interface BackupJob {
  id: string;
  schedule?: string;
  storage?: string;
  vmid?: string;
  all?: number;
  enabled?: number;
  mode?: string;
  compress?: string;
  "prune-backups"?: string;
  comment?: string;
  node?: string;
  mailto?: string;
}

export async function listBackupJobs(t: ProxmoxTicket) {
  return api<BackupJob[]>(t, `/cluster/backup`);
}

export async function createBackupJob(
  t: ProxmoxTicket,
  payload: Record<string, unknown>,
) {
  return api(t, `/cluster/backup`, { method: "POST", body: payload });
}

export async function updateBackupJob(
  t: ProxmoxTicket,
  id: string,
  payload: Record<string, unknown>,
) {
  return api(t, `/cluster/backup/${id}`, { method: "PUT", body: payload });
}

export async function deleteBackupJob(t: ProxmoxTicket, id: string) {
  return api(t, `/cluster/backup/${id}`, { method: "DELETE" });
}