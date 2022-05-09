import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

type WorkerSocket = WebSocket & {
  accept: () => void;
};
type WorkerResponse = Response & { webSocket?: WorkerSocket };
type WebSocketSendData = Parameters<WebSocket["send"]>[0];

declare const WebSocketPair: {
  new (): { 0: WorkerSocket; 1: WorkerSocket };
};

type WebSocketResponseInit = ResponseInit & { webSocket: WorkerSocket };

const proxmoxTicketSchema = z.object({
  baseUrl: z.string().url(),
  username: z.string(),
  ticket: z.string(),
  CSRFPreventionToken: z.string(),
  obtainedAt: z.number(),
});

const consoleConnectSchema = z.object({
  ticket: proxmoxTicketSchema,
  guest: z.object({
    node: z.string().regex(/^[A-Za-z0-9._-]+$/),
    type: z.enum(["qemu", "lxc"]),
    vmid: z.number().int().positive(),
  }),
});

function normalizeBaseUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("URL Proxmox HTTPS requise.");
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    throw new Error("URL Proxmox non autorisée depuis le proxy console.");
  }
  return url.origin;
}

function sendTerminalError(socket: WorkerSocket, message: string) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(`\r\n\x1b[31m${message}\x1b[0m\r\n`);
  }
}

function closeSocket(socket: WebSocket | undefined) {
  if (socket && socket.readyState !== WebSocket.CLOSED) socket.close();
}

function forward(socket: WebSocket | undefined, data: MessageEvent["data"]) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(data as WebSocketSendData);
  }
}

export const Route = createFileRoute("/api/proxmox/console")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
          return new Response("Expected Upgrade: websocket", { status: 426 });
        }

        const pair = new WebSocketPair();
        const client = pair[0];
        const server = pair[1];
        let upstream: WorkerSocket | undefined;
        let connecting = false;

        server.accept();

        server.addEventListener("message", async (event) => {
          if (upstream) {
            forward(upstream, event.data);
            return;
          }
          if (connecting) return;
          connecting = true;

          try {
            const input = consoleConnectSchema.parse(
              JSON.parse(typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data)),
            );
            const baseUrl = normalizeBaseUrl(input.ticket.baseUrl);
            const { node, type, vmid } = input.guest;
            const headers = {
              Cookie: `PVEAuthCookie=${input.ticket.ticket}`,
              CSRFPreventionToken: input.ticket.CSRFPreventionToken,
            };

            const termRes = await fetch(`${baseUrl}/api2/json/nodes/${node}/${type}/${vmid}/termproxy`, {
              method: "POST",
              headers,
            });
            if (!termRes.ok) {
              throw new Error(`Proxmox API termproxy → ${termRes.status}`);
            }

            const termJson = (await termRes.json()) as {
              data: { ticket: string; port: string | number; user?: string };
            };
            const wsRes = (await fetch(
              `${baseUrl.replace(/^http/, "ws")}/api2/json/nodes/${node}/${type}/${vmid}/vncwebsocket?port=${termJson.data.port}&vncticket=${encodeURIComponent(termJson.data.ticket)}`,
              {
                headers: {
                  Upgrade: "websocket",
                  Cookie: `PVEAuthCookie=${input.ticket.ticket}`,
                },
              },
            )) as WorkerResponse;

            if (wsRes.status !== 101 || !wsRes.webSocket) {
              throw new Error(`Proxmox WebSocket → ${wsRes.status}`);
            }

            upstream = wsRes.webSocket as WorkerSocket;
            upstream.accept();
            upstream.addEventListener("message", (upstreamEvent) => forward(server, upstreamEvent.data));
            upstream.addEventListener("close", () => closeSocket(server));
            upstream.addEventListener("error", () => closeSocket(server));
            upstream.send(`${termJson.data.user ?? input.ticket.username}:${termJson.data.ticket}\n`);
          } catch (error) {
            sendTerminalError(
              server,
              error instanceof Error ? error.message : "Erreur de connexion WebSocket.",
            );
            closeSocket(server);
          }
        });

        server.addEventListener("close", () => closeSocket(upstream));
        server.addEventListener("error", () => closeSocket(upstream));

        return new Response(null, {
          status: 101,
          webSocket: client,
        } as WebSocketResponseInit);
      },
    },
  },
});