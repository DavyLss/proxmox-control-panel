import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/proxmox/auth-context";
import {
  deleteBackupJob,
  listBackupJobs,
  listNodes,
} from "@/lib/proxmox/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { NodeBackupJobs } from "@/components/proxmox/node-backup-jobs";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/backups")({
  component: Backups,
});

function Backups() {
  const { ticket } = useAuth();
  const t = ticket!;
  const qc = useQueryClient();
  const nodesQ = useQuery({
    queryKey: ["nodes", t.baseUrl],
    queryFn: () => listNodes(t),
  });
  const jobsQ = useQuery({
    queryKey: ["backup-jobs"],
    queryFn: () => listBackupJobs(t),
    refetchInterval: 30_000,
  });

  const [node, setNode] = useState<string>("");
  if (!node && nodesQ.data?.length) setNode(nodesQ.data[0].node);

  const remove = useMutation({
    mutationFn: (id: string) => deleteBackupJob(t, id),
    onSuccess: () => {
      toast.success("Tâche supprimée");
      qc.invalidateQueries({ queryKey: ["backup-jobs"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sauvegardes</h1>
        <p className="text-sm text-muted-foreground">
          Tâches de sauvegarde planifiées au niveau cluster.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Toutes les tâches ({jobsQ.data?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(jobsQ.data ?? []).length === 0 && (
            <div className="text-sm text-muted-foreground py-4 text-center">
              Aucune tâche.
            </div>
          )}
          <div className="space-y-2">
            {(jobsQ.data ?? []).map((j) => (
              <div
                key={j.id}
                className="flex items-center justify-between rounded-md border border-border/60 p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <code className="text-xs">{j.id}</code>
                    <Badge variant={j.enabled ? "default" : "secondary"}>
                      {j.enabled ? "actif" : "désactivé"}
                    </Badge>
                    {j.node && <Badge variant="outline">node: {j.node}</Badge>}
                    {j.all ? (
                      <Badge variant="outline">tout</Badge>
                    ) : (
                      <Badge variant="outline">vmid: {j.vmid}</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {j.schedule} · {j.storage} · {j.mode ?? "snapshot"} ·{" "}
                    {j.compress ?? "zstd"}
                    {j["prune-backups"] && ` · ${j["prune-backups"]}`}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`Supprimer ${j.id} ?`)) remove.mutate(j.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Nouvelle tâche pour</CardTitle>
          <Select value={node} onValueChange={setNode}>
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue placeholder="Nœud" />
            </SelectTrigger>
            <SelectContent>
              {(nodesQ.data ?? []).map((n) => (
                <SelectItem key={n.node} value={n.node}>
                  {n.node}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {node && <NodeBackupJobs ticket={t} node={node} />}
        </CardContent>
      </Card>
    </div>
  );
}
