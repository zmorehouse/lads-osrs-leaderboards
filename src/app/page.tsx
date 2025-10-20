"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type SkillTriple = { rank: number; level: number; xp: number };
type PlayerPayload = {
  player: string;
  skills: Record<string, SkillTriple>;
  order: string[];
};

const DEFAULT_NAMES = [
  "Zoobz69",
  "loub0t69",
  "Melburne6",
  "Alexiisss",
  "JonezyAU",
  "ThyJamison",
];

type SortKey = "player" | "level" | "xp" | "rank";
type SortDir = "asc" | "desc";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [players, setPlayers] = useState<PlayerPayload[]>([]);
  const [skillOrder, setSkillOrder] = useState<string[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<string>("Overall");
  const [sortBy, setSortBy] = useState<SortKey>("level");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [errors, setErrors] = useState<string[]>([]);

  async function fetchPlayer(name: string): Promise<PlayerPayload | null> {
    const rsn = name.trim();
    if (!rsn) return null;
    const res = await fetch(`/api/osrs/${encodeURIComponent(rsn)}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`${rsn}: upstream ${res.status}`);
    return res.json();
  }

  const load = useCallback(async () => {
    setLoading(true);
    setErrors([]);
    try {
      const results = await Promise.allSettled(DEFAULT_NAMES.map(fetchPlayer));
      const ok: PlayerPayload[] = [];
      const errs: string[] = [];

      results.forEach((r, i) => {
        if (r.status === "fulfilled" && r.value) ok.push(r.value);
        else errs.push(DEFAULT_NAMES[i]);
      });

      setPlayers(ok);
      if (ok.length > 0) {
        setSkillOrder(ok[0].order);
        if (!ok[0].order.includes("Overall")) setSelectedSkill(ok[0].order[0]);
      }
      if (errs.length) setErrors(errs.map((e) => `Failed to load ${e}`));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setErrors([msg]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function headerClick(col: SortKey) {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(col);
    setSortDir("asc");
  }

  const rows = useMemo(() => {
    if (!players.length || !selectedSkill) return [];
    const base = players.map((p) => {
      const s = p.skills[selectedSkill];
      return { player: p.player, level: s.level, xp: s.xp, rank: s.rank };
    });

    base.sort((a, b) => {
      let primary = 0;
      if (sortBy === "player") primary = a.player.localeCompare(b.player);
      if (sortBy === "level") primary = a.level - b.level;
      if (sortBy === "xp") primary = a.xp - b.xp;
      if (sortBy === "rank") primary = a.rank - b.rank;

      if (primary !== 0) return sortDir === "asc" ? primary : -primary;

      // Tiebreakers: Level desc → XP desc → Rank asc → Player A→Z
      const byLevel = b.level - a.level;
      if (byLevel !== 0) return byLevel;
      const byXP = b.xp - a.xp;
      if (byXP !== 0) return byXP;
      const byRank = a.rank - b.rank;
      if (byRank !== 0) return byRank;
      return a.player.localeCompare(b.player);
    });

    return base.map((r, i) => ({ groupRank: i + 1, ...r }));
  }, [players, selectedSkill, sortBy, sortDir]);

  function ariaSort(col: SortKey): "none" | "ascending" | "descending" {
    if (sortBy !== col) return "none";
    return sortDir === "asc" ? "ascending" : "descending";
  }

  // A11y: put aria-sort on the <th>, not the button
  function SortableTH({
    col,
    className,
    children,
  }: {
    col: SortKey;
    className?: string;
    children: React.ReactNode;
  }) {
    return (
      <TableHead aria-sort={ariaSort(col)} className={className}>
        <button
          type="button"
          onClick={() => headerClick(col)}
          className="inline-flex items-center gap-1 font-medium hover:underline"
          title="Click to sort"
        >
          {children}
          <span aria-hidden className="text-xs opacity-70">
            {sortBy === col ? (sortDir === "asc" ? "▲" : "▼") : ""}
          </span>
        </button>
      </TableHead>
    );
  }

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-5xl space-y-6">


        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>
OnlyLads OSRS Rankings            </CardTitle>

            <div className="w-28">
              <Select value={selectedSkill} onValueChange={(v) => setSelectedSkill(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a skill" />
                </SelectTrigger>
                <SelectContent>
                  {skillOrder.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="overflow-auto">
            {errors.length > 0 && (
              <div className="mb-3 rounded-md border p-3 text-sm text-red-600">
                {errors.map((e, i) => (
                  <div key={i}>• {e}</div>
                ))}
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[90px]">Group Rank</TableHead>
                  <SortableTH col="player" className="min-w-[180px]">Player</SortableTH>
                  <SortableTH col="level" className="min-w-[80px]">Level</SortableTH>
                  <SortableTH col="xp" className="min-w-[140px]">XP</SortableTH>
                  <SortableTH col="rank" className="min-w-[100px]">Global Rank</SortableTH>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.player}>
                    <TableCell>#{r.groupRank}</TableCell>
                    <TableCell className="font-medium">{r.player}</TableCell>
                    <TableCell>{r.level}</TableCell>
                    <TableCell>{r.xp.toLocaleString()}</TableCell>
                    <TableCell>#{r.rank.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      {loading ? "Loading..." : "No data."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
