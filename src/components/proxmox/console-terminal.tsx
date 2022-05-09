import { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import {
  openNodeTermProxy,
  openTermProxy,
  type ProxmoxTicket,
} from "@/lib/proxmox/client";

export function ConsoleTerminal({
  ticket,
  guest,
  nodeShell,
}: {
  ticket: ProxmoxTicket;
  guest?: { node: string; type: "qemu" | "lxc"; vmid: number };
  nodeShell?: { node: string };
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    let term: Terminal | null = null;
    let ws: WebSocket | null = null;
    let fit: FitAddon | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { wsUrl, vncticket, user } = nodeShell
          ? await openNodeTermProxy(ticket, nodeShell.node)
          : await openTermProxy(ticket, guest!);
        if (cancelled) return;

        term = new Terminal({
          cursorBlink: true,
          fontSize: 13,
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
          theme: {
            background: "#111827",
            foreground: "#e5e7eb",
          },
        });
        fit = new FitAddon();
        term.loadAddon(fit);
        term.open(ref.current!);
        fit.fit();

        ws = new WebSocket(wsUrl);
        ws.binaryType = "arraybuffer";

        ws.onopen = () => {
          ws!.send(`${user}:${vncticket}\n`);
          term!.writeln("\x1b[32mConnecté à la console.\x1b[0m\r\n");
        };
        ws.onmessage = (ev) => {
          if (typeof ev.data === "string") term!.write(ev.data);
          else term!.write(new Uint8Array(ev.data as ArrayBuffer) as never);
        };
        ws.onclose = () => term?.writeln("\r\n\x1b[31mSession fermée.\x1b[0m");
        ws.onerror = () =>
          term?.writeln("\r\n\x1b[31mErreur de connexion WebSocket.\x1b[0m");

        term.onData((data) => {
          if (ws?.readyState === WebSocket.OPEN) {
            // Proxmox xterm protocol: prefix data length
            ws.send(`0:${data.length}:${data}`);
          }
        });

        const onResize = () => fit?.fit();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
      } catch (err) {
        const el = ref.current;
        if (el)
          el.innerHTML = `<div class="p-4 text-sm text-destructive">${
            err instanceof Error ? err.message : "Erreur"
          }</div>`;
      }
    })();

    return () => {
      cancelled = true;
      ws?.close();
      term?.dispose();
    };
  }, [ticket, guest?.node, guest?.type, guest?.vmid, nodeShell?.node]);

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden bg-[#111827]">
      <div ref={ref} className="h-[500px] w-full" />
    </div>
  );
}