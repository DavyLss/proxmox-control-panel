import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/lib/proxmox/auth-context";
import { guestAction, listAllGuests, type PveGuest } from "@/lib/proxmox/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Play,
  Square,
  RotateCcw,
  Power,
  Terminal,
  ExternalLink,
  Search,
} from "lucide-react";
import { bytes, pct, uptime } from "@/lib/proxmox/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/guests")({
  component: Guests,
});

function Guests() {
  const { ticket } = useAuth();
  const t = ticket!;
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "qemu" | "lxc">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["guests", t.baseUrl],
    queryFn: () => listAllGuests(t),
    refetchInterval: 5_000,
  });

  const action = useMutation({
    mutationFn: ({
      g,
      a,
    }: {
      g: PveGuest;
      a: "start" | "stop" | "shutdown" | "reboot";
    }) => guestAction(t, g, a),
    onSuccess: (_d, v) => {
      toast.success(`${v.a} envoyé à ${v.g.name ?? v.g.vmid}`);
      qc.invalidateQueries({ queryKey: ["guests"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const guests = (data ?? [])
    .filter((g) => typeFilter === "all" || g.type === typeFilter)
    .filter((g) =>
      `${g.vmid} ${g.name ?? ""} ${g.node}`
        .toLowerCase()
        .includes(filter.toLowerCase()),
    )
    .sort((a, b) => a.vmid - b.vmid);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Machines</h1>
          <p className="text-sm text-muted-foreground">
            VMs QEMU et conteneurs LXC du cluster
          </p>
        </div>
        <Button asChild>
          <Link to="/create">Nouvelle machine</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom, vmid ou nœud…"
              className="pl-8"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <div className="flex gap-1">
            {(["all", "qemu", "lxc"] as const).map((k) => (
              <Button
                key={k}
                variant={typeFilter === k ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter(k)}
              >
                {k === "all" ? "Tout" : k.toUpperCase()}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">VMID</th>
                  <th className="text-left px-4 py-2.5 font-medium">Nom</th>
                  <th className="text-left px-4 py-2.5 font-medium">Type</th>
                  <th className="text-left px-4 py-2.5 font-medium">Nœud</th>
                  <th className="text-left px-4 py-2.5 font-medium">Statut</th>
                  <th className="text-left px-4 py-2.5 font-medium">CPU</th>
                  <th className="text-left px-4 py-2.5 font-medium">RAM</th>
                  <th className="text-left px-4 py-2.5 font-medium">Uptime</th>
                  <th className="text-right px-4 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-muted-foreground">
                      Chargement…
                    </td>
                  </tr>
                )}
                {!isLoading && guests.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-muted-foreground">
                      Aucune machine trouvée.
                    </td>
                  </tr>
                )}
                {guests.map((g) => {
                  const running = g.status === "running";
                  return (
                    <tr
                      key={`${g.type}-${g.vmid}`}
                      className="border-t border-border/60 hover:bg-accent/20"
                    >
                      <td className="px-4 py-2 font-mono">{g.vmid}</td>
                      <td className="px-4 py-2">
                        <Link
                          to="/guests/$type/$node/$vmid"
                          params={{
                            type: g.type,
                            node: g.node,
                            vmid: String(g.vmid),
                          }}
                          className="font-medium hover:text-primary inline-flex items-center gap-1"
                        >
                          {g.name ?? `(sans nom)`}
                          <ExternalLink className="h-3 w-3 opacity-50" />
                        </Link>
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant="outline" className="uppercase">
                          {g.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-2">{g.node}</td>
                      <td className="px-4 py-2">
                        <span
                          className={
                            "inline-flex items-center gap-1.5 text-xs font-medium " +
                            (running
                              ? "text-[color:var(--success)]"
                              : "text-muted-foreground")
                          }
                        >
                          <span
                            className={
                              "h-2 w-2 rounded-full " +
                              (running
                                ? "bg-[color:var(--success)]"
                                : "bg-muted-foreground/50")
                            }
                          />
                          {g.status}
                        </span>
                      </td>
                      <td className="px-4 py-2">{pct(g.cpu)}</td>
                      <td className="px-4 py-2">
                        {bytes(g.mem)}/{bytes(g.maxmem)}
                      </td>
                      <td className="px-4 py-2">{uptime(g.uptime)}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <TooltipProvider>
                            <ActionBtn
                              label="Démarrer"
                              icon={Play}
                              disabled={running || action.isPending}
                              onClick={() =>
                                action.mutate({ g, a: "start" })
                              }
                            />
                            <ActionBtn
                              label="Redémarrer"
                              icon={RotateCcw}
                              disabled={!running || action.isPending}
                              onClick={() =>
                                action.mutate({ g, a: "reboot" })
                              }
                            />
                            <ActionBtn
                              label="Arrêt propre"
                              icon={Power}
                              disabled={!running || action.isPending}
                              onClick={() =>
                                action.mutate({ g, a: "shutdown" })
                              }
                            />
                            <ActionBtn
                              label="Forcer l'arrêt"
                              icon={Square}
                              variant="destructive"
                              disabled={!running || action.isPending}
                              onClick={() =>
                                action.mutate({ g, a: "stop" })
                              }
                            />
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button asChild size="icon" variant="ghost">
                                  <Link
                                    to="/guests/$type/$node/$vmid"
                                    params={{
                                      type: g.type,
                                      node: g.node,
                                      vmid: String(g.vmid),
                                    }}
                                    search={{ tab: "console" }}
                                  >
                                    <Terminal className="h-4 w-4" />
                                  </Link>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Console</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ActionBtn({
  label,
  icon: Icon,
  onClick,
  disabled,
  variant = "ghost",
}: {
  label: string;
  icon: typeof Play;
  onClick: () => void;
  disabled?: boolean;
  variant?: "ghost" | "destructive";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant={variant}
          onClick={onClick}
          disabled={disabled}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}