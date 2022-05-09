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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

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
  const [serialEnabled, setSerialEnabled] = useState(true);

  // Expert mode (Proxmox VE 9.1.6)
  const [expert, setExpert] = useState(false);

  // Common expert
  const [onboot, setOnboot] = useState(false);
  const [startOnCreate, setStartOnCreate] = useState(false);
  const [tags, setTags] = useState("");
  const [description, setDescription] = useState("");

  // QEMU expert
  const [bios, setBios] = useState<"seabios" | "ovmf">("seabios");
  const [machine, setMachine] = useState("");
  const [cpuType, setCpuType] = useState("x86-64-v2-AES");
  const [sockets, setSockets] = useState("1");
  const [numa, setNuma] = useState(false);
  const [balloon, setBalloon] = useState("");
  const [agent, setAgent] = useState(true);
  const [vga, setVga] = useState("std");
  const [scsihw, setScsihw] = useState("virtio-scsi-single");
  const [bootOrder, setBootOrder] = useState("order=scsi0;ide2;net0");
  const [ostypeQ, setOstypeQ] = useState("l26");
  const [vmArgs, setVmArgs] = useState("");
  const [efiStorage, setEfiStorage] = useState("");
  const [vlanTag, setVlanTag] = useState("");
  const [netModel, setNetModel] = useState("virtio");

  // LXC expert
  const [unprivileged, setUnprivileged] = useState(true);
  const [nesting, setNesting] = useState(true);
  const [keyctl, setKeyctl] = useState(true);
  const [fuse, setFuse] = useState(false);
  const [mountFeat, setMountFeat] = useState("");
  const [searchdomain, setSearchdomain] = useState("");
  const [nameserver, setNameserver] = useState("");
  const [sshKeys, setSshKeys] = useState("");
  const [ipv4, setIpv4] = useState("dhcp");
  const [gw4, setGw4] = useState("");
  const [ipv6, setIpv6] = useState("");
  const [swap, setSwap] = useState("512");

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
          net0:
            `${expert ? netModel : "virtio"},bridge=${bridge}` +
            (expert && vlanTag ? `,tag=${vlanTag}` : ""),
          scsihw: expert ? scsihw : "virtio-scsi-single",
          scsi0: `${storage}:${diskSize}`,
          ostype: expert ? ostypeQ : "l26",
        };
        if (serialEnabled) payload.serial0 = "socket";
        if (iso) payload.ide2 = `${iso},media=cdrom`;
        if (expert) {
          payload.sockets = Number(sockets);
          payload.bios = bios;
          if (machine) payload.machine = machine;
          payload.cpu = cpuType;
          payload.numa = numa ? 1 : 0;
          payload.agent = agent ? 1 : 0;
          payload.vga = vga;
          payload.boot = bootOrder;
          payload.onboot = onboot ? 1 : 0;
          payload.start = startOnCreate ? 1 : 0;
          if (balloon) payload.balloon = Number(balloon);
          if (tags) payload.tags = tags;
          if (description) payload.description = description;
          if (vmArgs) payload.args = vmArgs;
          if (bios === "ovmf" && efiStorage)
            payload.efidisk0 = `${efiStorage}:1,efitype=4m,pre-enrolled-keys=1`;
        }
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
          net0:
            `name=eth0,bridge=${bridge},ip=${expert ? ipv4 : "dhcp"}` +
            (expert && gw4 ? `,gw=${gw4}` : "") +
            (expert && ipv6 ? `,ip6=${ipv6}` : "") +
            (expert && vlanTag ? `,tag=${vlanTag}` : ""),
          password: password || undefined,
          unprivileged: expert ? (unprivileged ? 1 : 0) : 1,
        };
        if (expert) {
          const feats = [
            nesting && "nesting=1",
            keyctl && "keyctl=1",
            fuse && "fuse=1",
            mountFeat && `mount=${mountFeat}`,
          ].filter(Boolean);
          if (feats.length) payload.features = feats.join(",");
          payload.swap = Number(swap);
          payload.onboot = onboot ? 1 : 0;
          payload.start = startOnCreate ? 1 : 0;
          if (searchdomain) payload.searchdomain = searchdomain;
          if (nameserver) payload.nameserver = nameserver;
          if (sshKeys) payload["ssh-public-keys"] = sshKeys;
          if (tags) payload.tags = tags;
          if (description) payload.description = description;
        } else {
          // sane default for modern Debian/Ubuntu LXC
          payload.features = "nesting=1,keyctl=1";
        }
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

            <Collapsible open={expert} onOpenChange={setExpert}>
              <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2">
                <div>
                  <div className="text-sm font-medium">Mode expert</div>
                  <div className="text-xs text-muted-foreground">
                    Paramètres avancés Proxmox VE 9.1.6
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={expert} onCheckedChange={setExpert} />
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <ChevronDown
                        className={
                          "h-4 w-4 transition-transform " +
                          (expert ? "rotate-180" : "")
                        }
                      />
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </div>
              <CollapsibleContent className="pt-4 space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Tags (séparés par ;)">
                    <Input
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      placeholder="prod;web"
                    />
                  </Field>
                  <div className="flex items-end gap-6 pb-2">
                    <label className="flex items-center gap-2 text-sm">
                      <Switch checked={onboot} onCheckedChange={setOnboot} />
                      Démarrer au boot
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={startOnCreate}
                        onCheckedChange={setStartOnCreate}
                      />
                      Démarrer après création
                    </label>
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Description">
                      <Textarea
                        rows={2}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </Field>
                  </div>
                  <Field label="VLAN tag (optionnel)">
                    <Input
                      value={vlanTag}
                      onChange={(e) => setVlanTag(e.target.value)}
                      placeholder="ex: 10"
                    />
                  </Field>
                </div>

                {type === "qemu" && (
                  <div className="grid sm:grid-cols-2 gap-4 border-t border-border/60 pt-4">
                    <Pick
                      label="BIOS"
                      value={bios}
                      onChange={(v) => setBios(v as "seabios" | "ovmf")}
                      options={[
                        { value: "seabios", label: "SeaBIOS" },
                        { value: "ovmf", label: "OVMF (UEFI)" },
                      ]}
                    />
                    <Field label="Machine (ex: q35, pc-i440fx-9.0)">
                      <Input
                        value={machine}
                        onChange={(e) => setMachine(e.target.value)}
                        placeholder="q35"
                      />
                    </Field>
                    <Field label="Type CPU">
                      <Input
                        value={cpuType}
                        onChange={(e) => setCpuType(e.target.value)}
                        placeholder="host, x86-64-v2-AES…"
                      />
                    </Field>
                    <Field label="Sockets">
                      <Input
                        type="number"
                        min={1}
                        value={sockets}
                        onChange={(e) => setSockets(e.target.value)}
                      />
                    </Field>
                    <Field label="Ballooning min (MiB, vide = off)">
                      <Input
                        value={balloon}
                        onChange={(e) => setBalloon(e.target.value)}
                        placeholder="0 = désactivé"
                      />
                    </Field>
                    <Pick
                      label="VGA"
                      value={vga}
                      onChange={setVga}
                      options={[
                        { value: "std", label: "std" },
                        { value: "qxl", label: "qxl" },
                        { value: "virtio", label: "virtio" },
                        { value: "serial0", label: "serial0" },
                        { value: "none", label: "none" },
                      ]}
                    />
                    <Pick
                      label="SCSI controller"
                      value={scsihw}
                      onChange={setScsihw}
                      options={[
                        { value: "virtio-scsi-single", label: "virtio-scsi-single" },
                        { value: "virtio-scsi-pci", label: "virtio-scsi-pci" },
                        { value: "lsi", label: "lsi" },
                        { value: "megasas", label: "megasas" },
                      ]}
                    />
                    <Pick
                      label="Modèle réseau"
                      value={netModel}
                      onChange={setNetModel}
                      options={[
                        { value: "virtio", label: "virtio" },
                        { value: "e1000", label: "e1000" },
                        { value: "e1000e", label: "e1000e" },
                        { value: "rtl8139", label: "rtl8139" },
                        { value: "vmxnet3", label: "vmxnet3" },
                      ]}
                    />
                    <Field label="Type d'OS">
                      <Input
                        value={ostypeQ}
                        onChange={(e) => setOstypeQ(e.target.value)}
                        placeholder="l26, win11, other…"
                      />
                    </Field>
                    <Field label="Ordre de boot">
                      <Input
                        value={bootOrder}
                        onChange={(e) => setBootOrder(e.target.value)}
                      />
                    </Field>
                    {bios === "ovmf" && (
                      <Pick
                        label="Stockage EFI disk"
                        value={efiStorage}
                        onChange={setEfiStorage}
                        options={(storagesQ.data ?? [])
                          .filter((s) => s.content.includes("images"))
                          .map((s) => ({ value: s.storage, label: s.storage }))}
                      />
                    )}
                    <div className="flex items-end gap-6 pb-2">
                      <label className="flex items-center gap-2 text-sm">
                        <Switch checked={agent} onCheckedChange={setAgent} />
                        QEMU Guest Agent
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Switch checked={numa} onCheckedChange={setNuma} />
                        NUMA
                      </label>
                    </div>
                    <div className="sm:col-span-2">
                      <Field label="Args bruts (kvm)">
                        <Input
                          value={vmArgs}
                          onChange={(e) => setVmArgs(e.target.value)}
                          placeholder="-cpu host,+aes …"
                        />
                      </Field>
                    </div>
                  </div>
                )}

                {type === "lxc" && (
                  <div className="grid sm:grid-cols-2 gap-4 border-t border-border/60 pt-4">
                    <Field label="Swap (MiB)">
                      <Input
                        type="number"
                        min={0}
                        value={swap}
                        onChange={(e) => setSwap(e.target.value)}
                      />
                    </Field>
                    <Field label="IPv4 (dhcp ou CIDR)">
                      <Input
                        value={ipv4}
                        onChange={(e) => setIpv4(e.target.value)}
                        placeholder="dhcp ou 10.0.0.10/24"
                      />
                    </Field>
                    <Field label="Passerelle IPv4">
                      <Input
                        value={gw4}
                        onChange={(e) => setGw4(e.target.value)}
                        placeholder="10.0.0.1"
                      />
                    </Field>
                    <Field label="IPv6 (dhcp/auto/CIDR)">
                      <Input
                        value={ipv6}
                        onChange={(e) => setIpv6(e.target.value)}
                        placeholder="auto"
                      />
                    </Field>
                    <Field label="DNS searchdomain">
                      <Input
                        value={searchdomain}
                        onChange={(e) => setSearchdomain(e.target.value)}
                      />
                    </Field>
                    <Field label="DNS nameserver">
                      <Input
                        value={nameserver}
                        onChange={(e) => setNameserver(e.target.value)}
                        placeholder="1.1.1.1 8.8.8.8"
                      />
                    </Field>
                    <Field label="Mount features (nfs;cifs)">
                      <Input
                        value={mountFeat}
                        onChange={(e) => setMountFeat(e.target.value)}
                      />
                    </Field>
                    <div className="flex flex-wrap items-end gap-6 pb-2">
                      <label className="flex items-center gap-2 text-sm">
                        <Switch
                          checked={unprivileged}
                          onCheckedChange={setUnprivileged}
                        />
                        Non privilégié
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Switch checked={nesting} onCheckedChange={setNesting} />
                        nesting
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Switch checked={keyctl} onCheckedChange={setKeyctl} />
                        keyctl
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Switch checked={fuse} onCheckedChange={setFuse} />
                        fuse
                      </label>
                    </div>
                    <div className="sm:col-span-2">
                      <Field label="Clés SSH publiques (une par ligne)">
                        <Textarea
                          rows={3}
                          value={sshKeys}
                          onChange={(e) => setSshKeys(e.target.value)}
                          placeholder="ssh-ed25519 AAAA…"
                        />
                      </Field>
                    </div>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

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