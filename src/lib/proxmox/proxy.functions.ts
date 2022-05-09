import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type ProxmoxProxyData = Record<string, string | number | boolean | null>;

const proxmoxTicketSchema = z.object({
  baseUrl: z.string().url(),
  username: z.string(),
  ticket: z.string(),
  CSRFPreventionToken: z.string(),
  obtainedAt: z.number(),
});

const proxyInputSchema = z.object({
  ticket: proxmoxTicketSchema,
  path: z.string().startsWith("/"),
  method: z.enum(["POST", "PUT", "DELETE"]),
  body: z.record(z.unknown()).optional(),
});

export const proxmoxApiProxy = createServerFn({ method: "POST" })
  .inputValidator((data) => proxyInputSchema.parse(data))
  .handler(async ({ data }) => {
    const headers: Record<string, string> = {
      Cookie: `PVEAuthCookie=${data.ticket.ticket}`,
      CSRFPreventionToken: data.ticket.CSRFPreventionToken,
      "Content-Type": "application/x-www-form-urlencoded",
    };

    let body: BodyInit | undefined;
    if (data.body) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(data.body)) {
        if (value === undefined || value === null) continue;
        params.append(key, String(value));
      }
      body = params;
    }

    const res = await fetch(`${data.ticket.baseUrl}/api2/json${data.path}`, {
      method: data.method,
      headers,
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Proxmox API ${data.method} ${data.path} → ${res.status} ${text}`);
    }

    const json = (await res.json()) as { data: ProxmoxProxyData };
    return json.data;
  });