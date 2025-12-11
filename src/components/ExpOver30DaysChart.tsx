// components/ExpOver30DaysChart.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend);

type TimeseriesPoint = {
  timestamp: string;
  exp: number;
  level: number;
  rank: number | null;
};

type SeriesByPlayer = Record<
  string,
  {
    points: TimeseriesPoint[];
  }
>;

type Props = {
  players: string[];
};

type Mode = "exp" | "level";

const COLOR_PALETTE = [
  "hsl(220 80% 60%)",
  "hsl(142 72% 45%)",
  "hsl(24 95% 53%)",
  "hsl(280 65% 60%)",
  "hsl(190 90% 50%)",
  "hsl(48 96% 53%)",
  "hsl(340 82% 60%)",
];

export function ExpOver30DaysChart({ players }: Props) {
  const [series, setSeries] = useState<SeriesByPlayer>({});
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("exp");
  const [windowDays, setWindowDays] = useState<number>(30); 

  useEffect(() => {
    if (!players.length) return;

    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          skill: "Overall",
          players: players.join(","),
        });

        const res = await fetch(`/api/timeseries/group?${params.toString()}`);
        const json = await res.json();

        setSeries((json.series || {}) as SeriesByPlayer);
      } catch (e) {
        console.error("Failed to load timeseries (group)", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [players]);


  const windowLabel = useMemo(() => {
    if (windowDays === 7) return "Last 7 days";
    if (windowDays === 30) return "Last 30 days";
    if (windowDays === 90) return "Last 90 days";
    if (windowDays === 180) return "Last 180 days";
    if (windowDays >= 365) return "Last 365 days";
    return `Last ${windowDays} days`;
  }, [windowDays]);

  const { labels, datasets } = useMemo(() => {
    const now = new Date();
    const days: string[] = [];

    // Build last N days as YYYY-MM-DD
    for (let i = windowDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      days.push(iso);
    }

    const datasets = players.map((username, idx) => {
      const playerSeries = series[username]?.points ?? [];

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - windowDays);

      const sorted = playerSeries
        .map((p) => ({ ...p, date: new Date(p.timestamp) }))
        .filter((p) => p.date >= cutoff)
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      const dataForDays: (number | null)[] = [];
      let lastIndex = 0;
      let lastValue: number | null = null;

      for (const day of days) {
        const dayDate = new Date(day + "T23:59:59.999Z");

        while (
          lastIndex < sorted.length &&
          sorted[lastIndex].date.getTime() <= dayDate.getTime()
        ) {
          lastValue = mode === "exp" ? sorted[lastIndex].exp : sorted[lastIndex].level;
          lastIndex++;
        }

        dataForDays.push(lastValue);
      }

      const color = COLOR_PALETTE[idx % COLOR_PALETTE.length];

      return {
        label: username,
        data: dataForDays,
        borderColor: color,
        backgroundColor: color,
        spanGaps: true,
        tension: 0.25,
        pointRadius: 0,
        borderWidth: 2,
      };
    });

    return { labels: days, datasets };
  }, [players, series, mode, windowDays]);

  const hasData =
    datasets.length > 0 &&
    !datasets.every((d) => d.data.every((v) => v == null));

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <CardTitle>
          Overall {mode === "exp" ? "EXP" : "Levels"} – {windowLabel}
        </CardTitle>

        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
          <div className="w-full md:w-[180px]">
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Metric" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exp">EXP</SelectItem>
                <SelectItem value="level">Levels</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-full md:w-[260px]">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Time period</span>
              <span>{windowLabel}</span>
            </div>
            <Slider
              value={[windowDays]}
              min={7}
              max={365}
              step={1}
              onValueChange={(vals) => {
                const v = vals[0];
                if (!v) return;
                setWindowDays(v);
              }}
            />
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>1w</span>
              <span>1m</span>
              <span>3m</span>
              <span>6m</span>
              <span>1y</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="h-72">
        {loading && (
          <p className="text-sm text-muted-foreground">
            Loading {mode === "exp" ? "EXP" : "level"} history…
          </p>
        )}

        {!loading && !hasData && (
          <p className="text-sm text-muted-foreground">
            No {mode === "exp" ? "EXP" : "level"} history yet. Check back after a
            few snapshots have been logged.
          </p>
        )}

        {!loading && hasData && (
          <Line
            data={{ labels, datasets }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: "index", intersect: false },
              scales: {
                x: {
                  ticks: {
                    callback: (value, index) => {
                      const label = labels[index];
                      if (labels.length > 30 && index % 7 !== 0) return "";
                      if (labels.length > 15 && index % 3 !== 0) return "";
                      return label?.slice(5); 
                    },
                  },
                },
                y: {
                  beginAtZero: true,
                  ticks: {
                    callback: (value) => {
                      if (typeof value !== "number") return value;
                      if (mode === "level") return value; 
                      if (value >= 1_000_000) return `${value / 1_000_000}m`;
                      if (value >= 1_000) return `${value / 1_000}k`;
                      return value;
                    },
                  },
                },
              },
              plugins: {
                legend: {
                  position: "bottom",
                  labels: { boxWidth: 16, boxHeight: 16 },
                },
                tooltip: {
                  callbacks: {
                    label: (ctx) => {
                      const label = ctx.dataset.label || "";
                      const v = ctx.parsed.y;
                      if (v == null) return label;
                      if (mode === "level") {
                        return `${label}: lvl ${v}`;
                      }
                      return `${label}: ${v.toLocaleString()} XP`;
                    },
                  },
                },
              },
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
