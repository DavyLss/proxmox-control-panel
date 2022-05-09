import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/proxmox/auth-context";
import {
  getQemuConfig,
  guestAction,
  guestStatus,
  setQemuConfig,
} from "@/lib/proxmox/client";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Terminal } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, Play, Power, RotateCcw, Square } from "lucide-react";
import { ConsoleTerminal } from "@/components/proxmox/console-terminal";
import { RrdCharts } from "@/components/proxmox/rrd-charts";
import { GuestBackups } from "@/components/proxmox/guest-backups";
import { bytes, pct, uptime } from "@/lib/proxmox/format";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { z } from "zod";

const search = z.object({
  tab: z
    .enum(["overview", "monitoring", "console", "backups"])
    .default("overview"),
});

export const Route = createFileRoute("/_authenticated/guests/$type/$node/$vmid")({
  validateSearch: search,
  component: GuestDetail,
});

function GuestDetail() {
  const { type, node, vmid } = Route.useParams();
  const { tab } = Route.useSearch();
  const nav = useNavigate();
  const { ticket } = useAuth();
  const t = ticket!;
  const qc = useQueryClient();
  const guest = { type: type as "qemu" | "lxc", node, vmid: Number(vmid) };

  const statusQ = useQuery({
    queryKey: ["status", node, type, vmid],
    queryFn: () => guestStatus(t, guest),
    refetchInterval: 5_000,
  });

  const action = useMutation({
    mutationFn: (a: "start" | "stop" | "shutdown" | "reboot") =>
      guestAction(t, guest, a),
    onSuccess: (_d, a) => {
      toast.success(`${a} envoyé`);
      qc.invalidateQueries({ queryKey: ["status", node, type, vmid] });
      qc.invalidateQueries({ queryKey: ["guests"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const configQ = useQuery({
    queryKey: ["qemu-config", node, vmid],
    queryFn: () => getQemuConfig(t, node, Number(vmid)),
    enabled: type === "qemu",
  });
  const hasSerial = !!(configQ.data && (configQ.data as Record<string, unknown>).serial0);

  const enableSerial = useMutation({
    mutationFn: () => setQemuConfig(t, node, Number(vmid), { serial0: "socket" }),
    onSuccess: () => {
      toast.success("Port série activé. Redémarrez la VM pour l'appliquer.");
      qc.invalidateQueries({ queryKey: ["qemu-config", node, vmid] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const s = statusQ.data as
    | {
        name?: string;
        status?: string;
        cpu?: number;
        cpus?: number;
        mem?: number;
        maxmem?: number;
        uptime?: number;
        pid?: number;
      }
    | undefined;
  const running = s?.status === "running";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button asChild size="sm" variant="ghost">
          <Link to="/guests">
            <ChevronLeft className="h-4 w-4 mr-1" /> Retour
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight truncate">
            {s?.name ?? `(${vmid})`}
          </h1>
          <p className="text-sm text-muted-foreground">
            <Badge variant="outline" className="uppercase mr-2">
              {type}
            </Badge>
            VMID {vmid} · nœud {node}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            disabled={running || action.isPending}
            onClick={() => action.mutate("start")}
          >
            <Play className="h-4 w-4 mr-1.5" /> Démarrer
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!running || action.isPending}
            onClick={() => action.mutate("reboot")}
          >
            <RotateCcw className="h-4 w-4 mr-1.5" /> Redémarrer
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!running || action.isPending}
            onClick={() => action.mutate("shutdown")}
          >
            <Power className="h-4 w-4 mr-1.5" /> Arrêt
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={!running || action.isPending}
            onClick={() => action.mutate("stop")}
          >
            <Square className="h-4 w-4 mr-1.5" /> Stop
          </Button>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) =>
          nav({
            to: "/guests/$type/$node/$vmid",
            params: { type, node, vmid },
            search: {
              tab: v as "overview" | "monitoring" | "console" | "backups",
            },
          })
        }
      >
        <TabsList>
          <TabsTrigger value="overview">Vue</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="console">Console</TabsTrigger>
          <TabsTrigger value="backups">Sauvegardes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardContent className="p-5 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              <Field label="Statut" value={s?.status ?? "—"} />
              <Field label="Uptime" value={uptime(s?.uptime)} />
              <Field label="CPU" value={`${pct(s?.cpu)} / ${s?.cpus ?? "?"}c`} />
              <Field
                label="Mémoire"
                value={`${bytes(s?.mem)} / ${bytes(s?.maxmem)}`}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="mt-4">
          <RrdCharts ticket={t} guest={guest} />
        </TabsContent>

        <TabsContent value="console" className="mt-4">
          {type === "qemu" && configQ.data && !hasSerial && (
            <Card className="mb-3">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="text-sm">
                  <div className="font-medium">Pas de port série configuré</div>
                  <div className="text-muted-foreground text-xs">
                    xterm.js requiert <code>serial0: socket</code>. Ajoutez-le
                    puis redémarrez la VM.
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => enableSerial.mutate()}
                  disabled={enableSerial.isPending}
                >
                  <Terminal className="h-4 w-4 mr-1.5" />
                  Activer la console série
                </Button>
              </CardContent>
            </Card>
          )}
          {running ? (
            <ConsoleTerminal ticket={t} guest={guest} />
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                La machine doit être en cours d'exécution pour ouvrir la console.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="backups" className="mt-4">
          <GuestBackups ticket={t} guest={guest} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">
        {label}
      </div>
      <div className="text-base font-medium mt-0.5">{value}</div>
    </div>
  );
}