import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createBackupJob,
  deleteBackupJob,
  listAllGuests,
  listBackupJobs,
  listBackupStorages,
  updateBackupJob,
  type BackupJob,
  type ProxmoxTicket,
} from "@/lib/proxmox/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Pencil, ChevronDown, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface JobForm {
  id?: string;
  schedule: string;
  storage: string;
  vmid: string;
  all: boolean;
  enabled: boolean;
  mode: string;
  compress: string;
  comment: string;
  mailto: string;
  pruneBackups: string;
}

function pruneToString(p: BackupJob["prune-backups"]): string {
  if (!p) return "";
  if (typeof p === "string") return p;
  return Object.entries(p)
    .map(([k, v]) => `${k}=${v}`)
    .join(",");
}

const empty = (node: string): JobForm => ({
  schedule: "02:00",
  storage: "",
  vmid: "",
  all: true,
  enabled: true,
  mode: "snapshot",
  compress: "zstd",
  comment: `Job ${node}`,
  mailto: "",
  pruneBackups: "keep-last=7",
});

export function NodeBackupJobs({
  ticket,
  node,
}: {
  ticket: ProxmoxTicket;
  node: string;
}) {
  const t = ticket;
  const qc = useQueryClient();
  const jobsQ = useQuery({
    queryKey: ["backup-jobs"],
    queryFn: () => listBackupJobs(t),
    refetchInterval: 30_000,
  });
  const storagesQ = useQuery({
    queryKey: ["backup-storages", node],
    queryFn: () => listBackupStorages(t, node),
  });
  const guestsQ = useQuery({
    queryKey: ["all-guests"],
    queryFn: () => listAllGuests(t),
    staleTime: 30_000,
  });

  const jobs = (jobsQ.data ?? []).filter((j) => !j.node || j.node === node);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<JobForm>(empty(node));

  function openNew() {
    setForm({ ...empty(node), storage: storagesQ.data?.[0]?.storage ?? "" });
    setOpen(true);
  }
  function openEdit(j: BackupJob) {
    setForm({
      id: j.id,
      schedule: j.schedule ?? "02:00",
      storage: j.storage ?? "",
      vmid: j.vmid ?? "",
      all: !!j.all,
      enabled: j.enabled === undefined ? true : !!j.enabled,
      mode: j.mode ?? "snapshot",
      compress: j.compress ?? "zstd",
      comment: j.comment ?? "",
      mailto: j.mailto ?? "",
      pruneBackups: pruneToString(j["prune-backups"]),
    });
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        schedule: form.schedule,
        storage: form.storage,
        mode: form.mode,
        compress: form.compress,
        enabled: form.enabled ? 1 : 0,
        node,
        comment: form.comment || undefined,
        mailto: form.mailto || undefined,
        "prune-backups": form.pruneBackups || undefined,
      };
      if (form.all) payload.all = 1;
      else
        payload.vmid = form.vmid
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .join(",");
      if (form.id) return updateBackupJob(t, form.id, payload);
      return createBackupJob(t, payload);
    },
    onSuccess: () => {
      toast.success("Tâche de sauvegarde enregistrée");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["backup-jobs"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteBackupJob(t, id),
    onSuccess: () => {
      toast.success("Tâche supprimée");
      qc.invalidateQueries({ queryKey: ["backup-jobs"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Tâches planifiées (vzdump)</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" /> Nouvelle tâche
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {form.id ? "Modifier la tâche" : "Nouvelle tâche de sauvegarde"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Schedule (cron PVE)">
                  <Input
                    value={form.schedule}
                    onChange={(e) =>
                      setForm({ ...form, schedule: e.target.value })
                    }
                    placeholder="02:00 ou sat 03:00"
                  />
                </Field>
                <Field label="Stockage">
                  <Select
                    value={form.storage}
                    onValueChange={(v) => setForm({ ...form, storage: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {(storagesQ.data ?? []).map((s) => (
                        <SelectItem key={s.storage} value={s.storage}>
                          {s.storage}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Mode">
                  <Select
                    value={form.mode}
                    onValueChange={(v) => setForm({ ...form, mode: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="snapshot">snapshot</SelectItem>
                      <SelectItem value="suspend">suspend</SelectItem>
                      <SelectItem value="stop">stop</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Compression">
                  <Select
                    value={form.compress}
                    onValueChange={(v) => setForm({ ...form, compress: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zstd">zstd</SelectItem>
                      <SelectItem value="lzo">lzo</SelectItem>
                      <SelectItem value="gzip">gzip</SelectItem>
                      <SelectItem value="0">aucune</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Rétention (prune-backups)">
                <Input
                  value={form.pruneBackups}
                  onChange={(e) =>
                    setForm({ ...form, pruneBackups: e.target.value })
                  }
                  placeholder="keep-last=7,keep-weekly=4"
                />
              </Field>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={form.all}
                    onCheckedChange={(v) => setForm({ ...form, all: v })}
                  />
                  Toutes les VM/CT
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={form.enabled}
                    onCheckedChange={(v) => setForm({ ...form, enabled: v })}
                  />
                  Activé
                </label>
              </div>
              {!form.all && (
                <Field label="VM/CT cibles">
                  <VmidPicker
                    value={form.vmid}
                    onChange={(v) => setForm({ ...form, vmid: v })}
                    guests={(guestsQ.data ?? []).filter(
                      (g) => g.node === node && !g.template,
                    )}
                  />
                </Field>
              )}
              <Field label="Email notification">
                <Input
                  value={form.mailto}
                  onChange={(e) => setForm({ ...form, mailto: e.target.value })}
                  placeholder="admin@example.com"
                />
              </Field>
              <Field label="Commentaire">
                <Input
                  value={form.comment}
                  onChange={(e) =>
                    setForm({ ...form, comment: e.target.value })
                  }
                />
              </Field>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={() => save.mutate()}
                disabled={save.isPending || !form.storage}
              >
                {save.isPending ? "…" : "Enregistrer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {jobsQ.isLoading && (
          <div className="text-sm text-muted-foreground">Chargement…</div>
        )}
        {jobs.length === 0 && !jobsQ.isLoading && (
          <div className="text-sm text-muted-foreground py-6 text-center">
            Aucune tâche planifiée pour ce nœud.
          </div>
        )}
        <div className="space-y-2">
          {jobs.map((j) => (
            <div
              key={j.id}
              className="flex items-center justify-between rounded-md border border-border/60 p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <code className="text-xs">{j.id}</code>
                  <Badge variant={j.enabled ? "default" : "secondary"}>
                    {j.enabled ? "actif" : "désactivé"}
                  </Badge>
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
                {j.comment && (
                  <div className="text-xs mt-0.5 truncate">{j.comment}</div>
                )}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => openEdit(j)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`Supprimer la tâche ${j.id} ?`))
                      remove.mutate(j.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
