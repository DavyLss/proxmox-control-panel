/**
 * Minimal Proxmox VE API client (browser-side).
 * Self-hosted use: the browser talks directly to https://<proxmox>:8006.
 * Proxmox must allow CORS for the app's origin (or be reverse-proxied
 * under the same origin).
 */

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

const TICKET_TTL_MS = 1000 * 60 * 60 * 1.5; // Proxmox tickets last ~2h

export function isTicketValid(t: ProxmoxTicket | null): t is ProxmoxTicket {
  return !!t && Date.now() - t.obtainedAt < TICKET_TTL_MS;
}

function trimUrl(u: string) {
  return u.replace(/\/+$/, "");
}

export async function login(c: ProxmoxCredentials): Promise<ProxmoxTicket> {
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
  });

  if (!res.ok) {
    throw new Error(
      `Échec de l'authentification (${res.status}). Vérifiez l'URL, les identifiants et le realm.`,
    );
  }
  const json = (await res.json()) as {
    data: { ticket: string; CSRFPreventionToken: string; username: string };
  };
  return {
    baseUrl,
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
  const headers: Record<string, string> = {
    Cookie: `PVEAuthCookie=${t.ticket}`,
  };
  // Most browsers won't send the cookie cross-origin without proper config;
  // Proxmox also accepts the ticket via Authorization header for v8+.
  headers["Authorization"] = `PVEAuthCookie=${t.ticket}`;

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
  const path = g.type === "qemu" ? "termproxy" : "termproxy";
  const data = await api<{ ticket: string; port: string | number; user: string }>(
    t,
    `/nodes/${g.node}/${g.type}/${g.vmid}/${path}`,
    { method: "POST" },
  );
  const wsUrl =
    t.baseUrl.replace(/^http/, "ws") +
    `/api2/json/nodes/${g.node}/${g.type}/${g.vmid}/vncwebsocket?port=${data.port}&vncticket=${encodeURIComponent(
      data.ticket,
    )}`;
  return { wsUrl, ticket: data.ticket };
}