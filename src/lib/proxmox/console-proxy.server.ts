import { z } from "zod";

type WorkerSocket = WebSocket & { accept: () => void };
type WorkerResponse = Response & { webSocket?: WorkerSocket };
const consoleQuerySchema = z.object({
  baseUrl: z.string().url(),
  username: z.string(),
  ticket: z.string(),
  node: z.string().regex(/^[A-Za-z0-9._-]+$/),
  type: z.enum(["qemu", "lxc"]),
  vmid: z.coerce.number().int().positive(),
  port: z.coerce.number().int().positive(),
  vncticket: z.string(),
});

function normalizeBaseUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("URL Proxmox HTTPS requise.");
  return url.origin;
}

export function isProxmoxConsoleRequest(request: Request) {
  const url = new URL(request.url);
  return url.pathname === "/api/proxmox/console";
}

export async function handleProxmoxConsoleRequest(request: Request): Promise<Response> {
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return new Response("Expected Upgrade: websocket", { status: 426 });
  }

  try {
    const url = new URL(request.url);
    const input = consoleQuerySchema.parse(Object.fromEntries(url.searchParams));
    const baseUrl = normalizeBaseUrl(input.baseUrl);
    const upstream = (await fetch(
      `${baseUrl}/api2/json/nodes/${input.node}/${input.type}/${input.vmid}/vncwebsocket?port=${input.port}&vncticket=${encodeURIComponent(input.vncticket)}`,
      {
        headers: {
          Upgrade: "websocket",
          Cookie: `PVEAuthCookie=${input.ticket}`,
        },
      },
    )) as WorkerResponse;

    if (upstream.status !== 101 || !upstream.webSocket) {
      return new Response(`Proxmox WebSocket → ${upstream.status}`, { status: 502 });
    }

    return upstream;
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Paramètres console invalides", {
      status: 400,
    });
  }
}