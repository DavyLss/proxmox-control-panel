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
import { nodeRrd, type ProxmoxTicket } from "@/lib/proxmox/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type Frame = "hour" | "day" | "week";

export function NodeRrdCharts({
  ticket,
  node,
}: {
  ticket: ProxmoxTicket;
  node: string;
}) {
  const [tf, setTf] = useState<Frame>("hour");
  const { data } = useQuery({
    queryKey: ["node-rrd", node, tf],
    queryFn: () => nodeRrd(ticket, node, tf),
    refetchInterval: 30_000,
  });

  const series = (data ?? []).map((p) => ({
    t: new Date(p.time * 1000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    cpu: ((p.cpu ?? 0) * 100).toFixed(2),
    iowait: ((p.iowait ?? 0) * 100).toFixed(2),
    mem: ((p.memused ?? 0) / 1024 / 1024).toFixed(0),
    netin: ((p.netin ?? 0) / 1024).toFixed(0),
    netout: ((p.netout ?? 0) / 1024).toFixed(0),
    load: Number(p.loadavg ?? 0).toFixed(2),
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
        <Chart title="CPU (%)" data={series} dk="cpu" color="var(--chart-1)" />
        <Chart title="I/O wait (%)" data={series} dk="iowait" color="var(--chart-5)" />
        <Chart title="Mémoire utilisée (Mio)" data={series} dk="mem" color="var(--chart-3)" />
        <Chart title="Load avg" data={series} dk="load" color="var(--chart-2)" />
        <Chart title="Réseau in (Kio/s)" data={series} dk="netin" color="var(--chart-2)" />
        <Chart title="Réseau out (Kio/s)" data={series} dk="netout" color="var(--chart-4)" />
      </div>
    </div>
  );
}

function Chart({
  title,
  data,
  dk,
  color,
}: {
  title: string;
  data: Array<Record<string, string | number>>;
  dk: string;
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
              <linearGradient id={`gn-${dk}`} x1="0" y1="0" x2="0" y2="1">
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
              dataKey={dk}
              stroke={color}
              fill={`url(#gn-${dk})`}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
