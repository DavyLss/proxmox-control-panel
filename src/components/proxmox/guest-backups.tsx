import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteBackup,
  listBackups,
  listBackupStorages,
  vzdumpNow,
  type ProxmoxTicket,
} from "@/lib/proxmox/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { bytes } from "@/lib/proxmox/format";

export function GuestBackups({
  ticket,
  guest,
}: {
  ticket: ProxmoxTicket;
  guest: { node: string; type: "qemu" | "lxc"; vmid: number };
}) {
  const t = ticket;
  const qc = useQueryClient();
  const [storage, setStorage] = useState("");

  const storagesQ = useQuery({
    queryKey: ["backup-storages", guest.node],
    queryFn: () => listBackupStorages(t, guest.node),
  });

  useEffect(() => {
    if (!storage && storagesQ.data?.length)
      setStorage(storagesQ.data[0].storage);
  }, [storagesQ.data, storage]);

  const backupsQ = useQuery({
    queryKey: ["backups", guest.node, storage, guest.vmid],
    queryFn: () => listBackups(t, guest.node, storage, guest.vmid),
    enabled: !!storage,
    refetchInterval: 15_000,
  });

  const run = useMutation({
    mutationFn: () =>
      vzdumpNow(t, guest.node, { vmid: guest.vmid, storage }),
    onSuccess: () => {
      toast.success("Sauvegarde lancée");
      qc.invalidateQueries({ queryKey: ["backups"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: (volid: string) => deleteBackup(t, guest.node, storage, volid),
    onSuccess: () => {
      toast.success("Sauvegarde supprimée");
      qc.invalidateQueries({ queryKey: ["backups"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Sauvegardes</CardTitle>
        <div className="flex items-center gap-2">
          <Select value={storage} onValueChange={setStorage}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Stockage" />
            </SelectTrigger>
            <SelectContent>
              {(storagesQ.data ?? []).map((s) => (
                <SelectItem key={s.storage} value={s.storage}>
                  {s.storage}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={() => run.mutate()}
            disabled={run.isPending || !storage}
          >
            <Save className="h-4 w-4 mr-1.5" />
            Sauvegarder maintenant
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {backupsQ.isLoading && (
          <div className="text-sm text-muted-foreground">Chargement…</div>
        )}
        {!backupsQ.isLoading && (backupsQ.data ?? []).length === 0 && (
          <div className="text-sm text-muted-foreground py-6 text-center">
            Aucune sauvegarde trouvée pour cette VM/CT sur ce stockage.
          </div>
        )}
        <div className="space-y-2">
          {(backupsQ.data ?? [])
            .slice()
            .sort((a, b) => (b.ctime ?? 0) - (a.ctime ?? 0))
            .map((b) => (
              <div
                key={b.volid}
                className="flex items-center justify-between rounded-md border border-border/60 p-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {b.volid.split("/").pop()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {b.ctime
                      ? new Date(b.ctime * 1000).toLocaleString()
                      : "—"}
                    {" · "}
                    {bytes(b.size)}
                    {b.format ? ` · ${b.format}` : ""}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm("Supprimer cette sauvegarde ?"))
                      remove.mutate(b.volid);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
