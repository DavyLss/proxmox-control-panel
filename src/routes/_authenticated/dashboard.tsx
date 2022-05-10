import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/proxmox/auth-context";
import { listAllGuests, listNodes } from "@/lib/proxmox/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Server, Cpu, MemoryStick, Activity, Boxes } from "lucide-react";
import { bytes, pct, uptime } from "@/lib/proxmox/format";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Server;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5 flex items-start gap-4">
        <div className="grid place-items-center h-10 w-10 rounded-lg bg-primary/15 text-primary shrink-0">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
          <div className="text-2xl font-semibold mt-0.5">{value}</div>
          {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const { ticket } = useAuth();
  const t = ticket!;
  const nodesQ = useQuery({
    queryKey: ["nodes", t.baseUrl],
    queryFn: () => listNodes(t),
    refetchInterval: 10_000,
  });
  const guestsQ = useQuery({
    queryKey: ["guests", t.baseUrl],
    queryFn: () => listAllGuests(t),
    refetchInterval: 10_000,
  });

  const nodes = nodesQ.data ?? [];
  const guests = guestsQ.data ?? [];
  const running = guests.filter((g) => g.status === "running").length;
  const totalCpu = nodes.reduce((a, n) => a + (n.maxcpu ?? 0), 0);
  const usedCpu =
    nodes.reduce((a, n) => a + (n.cpu ?? 0) * (n.maxcpu ?? 0), 0) / Math.max(1, totalCpu);
  const totalMem = nodes.reduce((a, n) => a + (n.maxmem ?? 0), 0);
  const usedMem = nodes.reduce((a, n) => a + (n.mem ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vue d'ensemble</h1>
        <p className="text-sm text-muted-foreground">État global du cluster Proxmox</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={Server}
          label="Nœuds"
          value={String(nodes.length)}
          hint={`${nodes.filter((n) => n.status === "online").length} en ligne`}
        />
        <Stat
          icon={Boxes}
          label="Machines"
          value={String(guests.length)}
          hint={`${running} en cours d'exécution`}
        />
        <Stat
          icon={Cpu}
          label="CPU global"
          value={pct(usedCpu)}
          hint={`${totalCpu} cœurs cumulés`}
        />
        <Stat
          icon={MemoryStick}
          label="Mémoire"
          value={bytes(usedMem)}
          hint={`sur ${bytes(totalMem)}`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nœuds</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {nodes.map((n) => (
              <Link
                key={n.node}
                to="/guests"
                className="block rounded-lg border border-border/60 p-4 hover:border-primary/60 hover:bg-accent/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Activity
                      className={
                        "h-4 w-4 " +
                        (n.status === "online" ? "text-[color:var(--success)]" : "text-destructive")
                      }
                    />
                    <span className="font-medium">{n.node}</span>
                  </div>
                  <Badge variant={n.status === "online" ? "default" : "destructive"}>
                    {n.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div>
                    <div>CPU</div>
                    <div className="text-foreground font-medium">{pct(n.cpu)}</div>
                  </div>
                  <div>
                    <div>RAM</div>
                    <div className="text-foreground font-medium">
                      {bytes(n.mem)}/{bytes(n.maxmem)}
                    </div>
                  </div>
                  <div>
                    <div>Uptime</div>
                    <div className="text-foreground font-medium">{uptime(n.uptime)}</div>
                  </div>
                </div>
              </Link>
            ))}
            {nodesQ.isLoading && <div className="text-sm text-muted-foreground">Chargement…</div>}
            {nodesQ.error && (
              <div className="text-sm text-destructive">{(nodesQ.error as Error).message}</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
