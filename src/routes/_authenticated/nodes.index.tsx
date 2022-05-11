import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/proxmox/auth-context";
import { listNodes } from "@/lib/proxmox/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { bytes, pct, uptime } from "@/lib/proxmox/format";

export const Route = createFileRoute("/_authenticated/nodes/")({
  component: NodesList,
});

function NodesList() {
  const { ticket } = useAuth();
  const t = ticket!;
  const nodesQ = useQuery({
    queryKey: ["nodes", t.baseUrl],
    queryFn: () => listNodes(t),
    refetchInterval: 10_000,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nœuds</h1>
        <p className="text-sm text-muted-foreground">
           Cluster Proxmox - sélectionnez un nœud pour voir ses statistiques et ouvrir une console.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{nodesQ.data?.length ?? 0} nœud(s)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {(nodesQ.data ?? []).map((n) => (
              <Link
                key={n.node}
                to="/nodes/$node"
                params={{ node: n.node }}
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
                  <div className="flex items-center gap-2">
                    <Badge variant={n.status === "online" ? "default" : "destructive"}>
                      {n.status}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
