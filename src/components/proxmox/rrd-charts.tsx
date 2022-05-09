import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { guestRrd, type ProxmoxTicket } from "@/lib/proxmox/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type Frame = "hour" | "day" | "week";

export function RrdCharts({
  ticket,
  guest,
}: {
  ticket: ProxmoxTicket;
  guest: { node: string; type: "qemu" | "lxc"; vmid: number };
}) {
  const [tf, setTf] = useState<Frame>("hour");
  const { data } = useQuery({
    queryKey: ["rrd", guest.node, guest.type, guest.vmid, tf],
    queryFn: () => guestRrd(ticket, guest, tf),
    refetchInterval: 30_000,
  });

  const series = (data ?? []).map((p) => ({
    t: new Date(p.time * 1000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    cpu: ((p.cpu ?? 0) * 100).toFixed(2),
    mem: ((p.mem ?? 0) / 1024 / 1024).toFixed(0),
    netin: ((p.netin ?? 0) / 1024).toFixed(0),
    netout: ((p.netout ?? 0) / 1024).toFixed(0),
  }));

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {(["hour", "day", "week"] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={tf === f ? "default" : "outline"}
            onClick={() => setTf(f)}
          >
            {f === "hour" ? "1h" : f === "day" ? "24h" : "7j"}
          </Button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title="CPU (%)" data={series} dataKey="cpu" color="var(--chart-1)" />
        <ChartCard title="Mémoire (Mio)" data={series} dataKey="mem" color="var(--chart-3)" />
        <ChartCard title="Réseau in (Kio/s)" data={series} dataKey="netin" color="var(--chart-2)" />
        <ChartCard title="Réseau out (Kio/s)" data={series} dataKey="netout" color="var(--chart-4)" />
      </div>
    </div>
  );
}

function ChartCard({
  title,
  data,
  dataKey,
  color,
}: {
  title: string;
  data: Array<Record<string, string | number>>;
  dataKey: string;
  color: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="t" stroke="var(--muted-foreground)" fontSize={11} />
            <YAxis stroke="var(--muted-foreground)" fontSize={11} width={40} />
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              fill={`url(#g-${dataKey})`}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}