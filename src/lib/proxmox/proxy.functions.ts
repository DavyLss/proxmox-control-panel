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
  path: z.string().regex(/^\/nodes\/[A-Za-z0-9._-]+\/(qemu|lxc)\/\d+\/termproxy$/),
});

export const proxmoxApiProxy = createServerFn({ method: "POST" })
  .inputValidator((data) => proxyInputSchema.parse(data))
  .handler(async ({ data }) => {
    const headers: Record<string, string> = {
      Cookie: `PVEAuthCookie=${data.ticket.ticket}`,
      CSRFPreventionToken: data.ticket.CSRFPreventionToken,
      "Content-Type": "application/x-www-form-urlencoded",
    };

    const res = await fetch(`${data.ticket.baseUrl}/api2/json${data.path}`, {
      method: "POST",
      headers,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Proxmox API POST ${data.path} → ${res.status} ${text}`);
    }

    const json = (await res.json()) as { data: ProxmoxProxyData };
    return json.data;
  });