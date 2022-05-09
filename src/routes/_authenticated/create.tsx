import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/proxmox/auth-context";
import {
  createLxc,
  createQemu,
  listIso,
  listNodes,
  listStorage,
  listTemplates,
  nextVmid,
} from "@/lib/proxmox/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/create")({
  component: Create,
});

function Create() {
  const { ticket } = useAuth();
  const t = ticket!;
  const nav = useNavigate();
  const [type, setType] = useState<"qemu" | "lxc">("qemu");

  const nodesQ = useQuery({ queryKey: ["nodes"], queryFn: () => listNodes(t) });
  const [node, setNode] = useState<string>("");

  useEffect(() => {
    if (!node && nodesQ.data?.length) setNode(nodesQ.data[0].node);
  }, [nodesQ.data, node]);

  const vmidQ = useQuery({
    queryKey: ["nextid"],
    queryFn: () => nextVmid(t),
  });

  const storagesQ = useQuery({
    queryKey: ["storages", node],
    queryFn: () => listStorage(t, node),
    enabled: !!node,
  });

  // Common form state
  const [vmid, setVmid] = useState<string>("");
  const [name, setName] = useState("");
  const [cores, setCores] = useState("2");
  const [memory, setMemory] = useState("2048"); // MiB
  const [diskSize, setDiskSize] = useState("16"); // GiB
  const [storage, setStorage] = useState<string>("");
  const [isoStorage, setIsoStorage] = useState<string>("");
  const [iso, setIso] = useState<string>("");
  const [tmplStorage, setTmplStorage] = useState<string>("");
  const [tmpl, setTmpl] = useState<string>("");
  const [password, setPassword] = useState("");
  const [bridge, setBridge] = useState("vmbr0");

  useEffect(() => {
    if (vmidQ.data && !vmid) setVmid(String(vmidQ.data));
  }, [vmidQ.data, vmid]);

  useEffect(() => {
    const storages = storagesQ.data ?? [];
    if (!storage && storages.find((s) => s.content.includes("images")))
      setStorage(storages.find((s) => s.content.includes("images"))!.storage);
    if (!isoStorage && storages.find((s) => s.content.includes("iso")))
      setIsoStorage(storages.find((s) => s.content.includes("iso"))!.storage);
    if (!tmplStorage && storages.find((s) => s.content.includes("vztmpl")))
      setTmplStorage(
        storages.find((s) => s.content.includes("vztmpl"))!.storage,
      );
  }, [storagesQ.data, storage, isoStorage, tmplStorage]);

  const isoQ = useQuery({
    queryKey: ["iso", node, isoStorage],
    queryFn: () => listIso(t, node, isoStorage),
    enabled: !!node && !!isoStorage && type === "qemu",
  });
  const tmplQ = useQuery({
    queryKey: ["tmpl", node, tmplStorage],
    queryFn: () => listTemplates(t, node, tmplStorage),
    enabled: !!node && !!tmplStorage && type === "lxc",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (type === "qemu") {
        const payload: Record<string, unknown> = {
          vmid: Number(vmid),
          name: name || `vm-${vmid}`,
          cores: Number(cores),
          memory: Number(memory),
          net0: `virtio,bridge=${bridge}`,
          scsihw: "virtio-scsi-single",
          scsi0: `${storage}:${diskSize}`,
          ostype: "l26",
        };
        if (iso) payload.ide2 = `${iso},media=cdrom`;
        return createQemu(t, node, payload);
      } else {
        if (!tmpl) throw new Error("Sélectionnez un template LXC");
        const payload: Record<string, unknown> = {
          vmid: Number(vmid),
          hostname: name || `ct-${vmid}`,
          ostemplate: tmpl,
          cores: Number(cores),
          memory: Number(memory),
          rootfs: `${storage}:${diskSize}`,
          net0: `name=eth0,bridge=${bridge},ip=dhcp`,
          password: password || undefined,
          unprivileged: 1,
        };
        return createLxc(t, node, payload);
      }
    },
    onSuccess: () => {
      toast.success("Tâche de création envoyée");
      nav({ to: "/guests" });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Nouvelle machine
        </h1>
        <p className="text-sm text-muted-foreground">
          Créer une VM QEMU ou un conteneur LXC
        </p>
      </div>

      <Tabs value={type} onValueChange={(v) => setType(v as "qemu" | "lxc")}>
        <TabsList>
          <TabsTrigger value="qemu">VM (QEMU)</TabsTrigger>
          <TabsTrigger value="lxc">Conteneur (LXC)</TabsTrigger>
        </TabsList>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Pick label="Nœud" value={node} onChange={setNode}
                options={(nodesQ.data ?? []).map((n) => ({ value: n.node, label: n.node }))}
              />
              <Field label="VMID">
                <Input value={vmid} onChange={(e) => setVmid(e.target.value)} />
              </Field>
              <Field label={type === "qemu" ? "Nom" : "Hostname"}>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Bridge réseau">
                <Input value={bridge} onChange={(e) => setBridge(e.target.value)} />
              </Field>
              <Field label="vCPU">
                <Input
                  type="number"
                  min={1}
                  value={cores}
                  onChange={(e) => setCores(e.target.value)}
                />
              </Field>
              <Field label="Mémoire (MiB)">
                <Input
                  type="number"
                  min={128}
                  value={memory}
                  onChange={(e) => setMemory(e.target.value)}
                />
              </Field>
              <Field label="Disque (GiB)">
                <Input
                  type="number"
                  min={1}
                  value={diskSize}
                  onChange={(e) => setDiskSize(e.target.value)}
                />
              </Field>
              <Pick
                label="Stockage disque"
                value={storage}
                onChange={setStorage}
                options={(storagesQ.data ?? [])
                  .filter((s) =>
                    s.content.includes(type === "qemu" ? "images" : "rootdir"),
                  )
                  .map((s) => ({ value: s.storage, label: s.storage }))}
              />
            </div>

            <TabsContent value="qemu" className="space-y-4 m-0">
              <div className="grid sm:grid-cols-2 gap-4">
                <Pick
                  label="Stockage ISO"
                  value={isoStorage}
                  onChange={setIsoStorage}
                  options={(storagesQ.data ?? [])
                    .filter((s) => s.content.includes("iso"))
                    .map((s) => ({ value: s.storage, label: s.storage }))}
                />
                <Pick
                  label="Image ISO"
                  value={iso}
                  onChange={setIso}
                  options={(isoQ.data ?? []).map((i) => ({
                    value: i.volid,
                    label: i.volid.split("/").pop() ?? i.volid,
                  }))}
                />
              </div>
            </TabsContent>

            <TabsContent value="lxc" className="space-y-4 m-0">
              <div className="grid sm:grid-cols-2 gap-4">
                <Pick
                  label="Stockage templates"
                  value={tmplStorage}
                  onChange={setTmplStorage}
                  options={(storagesQ.data ?? [])
                    .filter((s) => s.content.includes("vztmpl"))
                    .map((s) => ({ value: s.storage, label: s.storage }))}
                />
                <Pick
                  label="Template"
                  value={tmpl}
                  onChange={setTmpl}
                  options={(tmplQ.data ?? []).map((i) => ({
                    value: i.volid,
                    label: i.volid.split("/").pop() ?? i.volid,
                  }))}
                />
                <Field label="Mot de passe root">
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </Field>
              </div>
            </TabsContent>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => nav({ to: "/guests" })}>
                Annuler
              </Button>
              <Button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending || !node || !storage}
              >
                {mutation.isPending ? "Création…" : "Créer"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Pick({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <Field label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          {options.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              Aucune option
            </div>
          )}
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}