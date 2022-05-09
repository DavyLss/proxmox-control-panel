import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  getPermissions,
  hasPermission,
  nodeStatus,
} from "@/lib/proxmox/client";
import { useAuth } from "@/lib/proxmox/auth-context";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft } from "lucide-react";
import { bytes, pct, uptime } from "@/lib/proxmox/format";
import { ConsoleTerminal } from "@/components/proxmox/console-terminal";
import { NodeRrdCharts } from "@/components/proxmox/node-rrd-charts";
import { NodeBackupJobs } from "@/components/proxmox/node-backup-jobs";

const search = z.object({
  tab: z
    .enum(["overview", "monitoring", "console", "backups"])
    .default("overview"),
});

export const Route = createFileRoute("/_authenticated/nodes/$node")({
  validateSearch: search,
  component: NodeDetail,
});

function NodeDetail() {
  const { node } = Route.useParams();
  const { tab } = Route.useSearch();
  const nav = useNavigate();
  const { ticket } = useAuth();
  const t = ticket!;

  const statusQ = useQuery({
    queryKey: ["node-status", node],
    queryFn: () => nodeStatus(t, node),
    refetchInterval: 5_000,
  });
  const permsQ = useQuery({
    queryKey: ["perms", t.username],
    queryFn: () => getPermissions(t),
    staleTime: 60_000,
  });

  const canConsole = hasPermission(permsQ.data, `/nodes/${node}`, "Sys.Console");

  const s = statusQ.data;
  const memUsed = s?.memory?.used ?? 0;
  const memTotal = s?.memory?.total ?? 0;
  const rootUsed = s?.rootfs?.used ?? 0;
  const rootTotal = s?.rootfs?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button asChild size="sm" variant="ghost">
          <Link to="/nodes">
            <ChevronLeft className="h-4 w-4 mr-1" /> Retour
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight truncate">
            {node}
          </h1>
          <p className="text-sm text-muted-foreground">
            <Badge variant="outline" className="mr-2">
              nœud
            </Badge>
            {s?.pveversion ?? ""} · noyau {s?.kversion ?? "—"}
          </p>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) =>
          nav({
            to: "/nodes/$node",
            params: { node },
            search: {
              tab: v as "overview" | "monitoring" | "console" | "backups",
            },
          })
        }
      >
        <TabsList>
          <TabsTrigger value="overview">Vue</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="console" disabled={!canConsole}>
            Console{!canConsole && " (droits requis)"}
          </TabsTrigger>
          <TabsTrigger value="backups">Sauvegardes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardContent className="p-5 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              <Stat label="CPU" value={`${pct(s?.cpu)} / ${s?.cpuinfo?.cpus ?? "?"}c`} />
              <Stat label="Modèle CPU" value={s?.cpuinfo?.model ?? "—"} />
              <Stat
                label="Load avg"
                value={(s?.loadavg ?? []).join(" / ") || "—"}
              />
              <Stat label="Uptime" value={uptime(s?.uptime)} />
              <Stat
                label="Mémoire"
                value={`${bytes(memUsed)} / ${bytes(memTotal)}`}
                hint={pct(memUsed / Math.max(1, memTotal))}
              />
              <Stat
                label="Swap"
                value={`${bytes(s?.swap?.used)} / ${bytes(s?.swap?.total)}`}
              />
              <Stat
                label="Disque /"
                value={`${bytes(rootUsed)} / ${bytes(rootTotal)}`}
                hint={pct(rootUsed / Math.max(1, rootTotal))}
              />
              <Stat label="Version PVE" value={s?.pveversion ?? "—"} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="mt-4">
          <NodeRrdCharts ticket={t} node={node} />
        </TabsContent>

        <TabsContent value="console" className="mt-4">
          {canConsole ? (
            <ConsoleTerminal ticket={t} nodeShell={{ node }} />
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Vous n'avez pas le privilège <code>Sys.Console</code> sur ce
                nœud.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="backups" className="mt-4">
          <NodeBackupJobs ticket={t} node={node} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">
        {label}
      </div>
      <div className="text-base font-medium mt-0.5 break-all">{value}</div>
      {hint && (
        <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
      )}
    </div>
  );
}
