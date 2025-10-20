/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @next/next/no-img-element */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

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

const COMBAT_SKILLS = [
  "Attack",
  "Strength",
  "Defence",
  "Hitpoints",
  "Ranged",
  "Prayer",
  "Magic",
] as const;

const isCombat = (s: string) =>
  (COMBAT_SKILLS as readonly string[]).includes(s);
const isRanked = (n: number) => n >= 0;

const NOT_QUALIFIED = "N/A";

const LEVEL_XP: number[] = (() => {
  const arr: number[] = [];
  arr[1] = 0;
  let acc = 0;
  for (let lvl = 1; lvl < 99; lvl++) {
    acc += Math.floor((lvl + 300 * Math.pow(2, lvl / 7)) / 4);
    arr[lvl + 1] = acc;
  }
  arr[100] = arr[99];
  return arr;
})();

function xpToNextLevel(level: number, xp: number): number | null {
  if (level >= 99 || level <= 0 || xp < 0) return null;
  const target = LEVEL_XP[level + 1];
  return Math.max(0, target - xp);
}

const xpTo99 = (level: number, xp: number) => {
  if (level >= 99 || level <= 0 || xp < 0) return null;
  return Math.max(0, LEVEL_XP[99] - xp);
};

type SortKey = "level" | "xp" | "rank";
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
    const res = await fetch(`/api/osrs/${encodeURIComponent(rsn)}`);
    if (!res.ok) throw new Error(`${rsn}: upstream ${res.status}`);
    return res.json();
  }

  const skillIconUrl = (skill: string) => {
    const overrides: Record<string, string> = {
      Overall: "Stats_icon.png",
    };

    const file = overrides[skill] ?? `${skill}_icon.png`;
    const fileTitle = file.replace(/\s+/g, "_");
    return `https://oldschool.runescape.wiki/w/Special:FilePath/${fileTitle}`;
  };

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

  const forceRefresh = useCallback(async () => {
    setLoading(true);
    setErrors([]);
    try {
      await fetch("/api/osrs/revalidate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ players: DEFAULT_NAMES }),
      });
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setErrors([`Refresh failed: ${msg}`]);
    } finally {
      setLoading(false);
    }
  }, [load]);

  function betterCmp(
    a: { _levelN: number; _xpN: number; _rankN: number; player: string },
    b: { _levelN: number; _xpN: number; _rankN: number; player: string }
  ) {
    let primary = 0;
    if (sortBy === "level") primary = b._levelN - a._levelN;
    else if (sortBy === "xp") primary = b._xpN - a._xpN;
    else primary = a._rankN - b._rankN;

    if (primary !== 0) return primary;

    let t = b._levelN - a._levelN;
    if (t !== 0) return t;
    t = b._xpN - a._xpN;
    if (t !== 0) return t;
    t = a._rankN - b._rankN;
    if (t !== 0) return t;
    return a.player.localeCompare(b.player);
  }

  const extra = useMemo(() => {
    if (!players.length) {
      return {
        closest: null as null | {
          player: string;
          skill: string;
          level: number;
          xpToNext: number;
        },
        furthest: null as null | {
          player: string;
          skill: string;
          level: number;
          xpToNext: number;
        },
        groupTotalXP: 0,
        groupTotalLevel: 0,
        mostCombat: null as null | { player: string; xp: number },
        topSkiller: null as null | { player: string; xp: number },
        highestAvg: null as null | { player: string; avg: number },
        lowestSkill: null as null | {
          player: string;
          skill: string;
          level: number;
          xp: number;
        },
        overallGap: null as null | {
          first: string;
          second: string;
          gap: number;
        },
      };
    }

    let closest: null | {
      player: string;
      skill: string;
      level: number;
      xpToNext: number;
    } = null;
    let furthest: null | {
      player: string;
      skill: string;
      level: number;
      xpToNext: number;
    } = null;

    let groupTotalXP = 0;
    let groupTotalLevel = 0;

    let mostCombat: null | { player: string; xp: number } = null;
    let topSkiller: null | { player: string; xp: number } = null;
    let highestAvg: null | { player: string; avg: number } = null;

    let lowestSkill: null | {
      player: string;
      skill: string;
      level: number;
      xp: number;
    } = null;

    const overallRank = [] as Array<{ player: string; xp: number }>;

    const skillsToCheck = skillOrder.filter((s) => s !== "Overall");

    for (const p of players) {
      const overall = p.skills["Overall"];
      if (overall && isRanked(overall.xp) && isRanked(overall.level)) {
        groupTotalXP += overall.xp;
        groupTotalLevel += overall.level;
        overallRank.push({ player: p.player, xp: overall.xp });
      }

      let combatXP = 0;
      let skillingXP = 0;

      let levelSum = 0;
      let levelCount = 0;

      for (const skill of skillsToCheck) {
        const s = p.skills[skill];
        if (!s) continue;

        if (
          s.level >= 1 &&
          s.level < 99 &&
          isRanked(s.rank) &&
          isRanked(s.level) &&
          isRanked(s.xp)
        ) {
          const delta = xpToNextLevel(s.level, s.xp);
          if (delta != null) {
            if (!closest || delta < closest.xpToNext) {
              closest = {
                player: p.player,
                skill,
                level: s.level,
                xpToNext: delta,
              };
            }
            if (!furthest || delta > furthest.xpToNext) {
              furthest = {
                player: p.player,
                skill,
                level: s.level,
                xpToNext: delta,
              };
            }
          }
        }

        if (isRanked(s.xp)) {
          if (isCombat(skill)) combatXP += s.xp;
          else skillingXP += s.xp;
        }

        if (isRanked(s.level)) {
          levelSum += s.level;
          levelCount += 1;
        }

        if (isRanked(s.level) && isRanked(s.xp)) {
          if (
            !lowestSkill ||
            s.level < lowestSkill.level ||
            (s.level === lowestSkill.level && s.xp < lowestSkill.xp)
          ) {
            lowestSkill = { player: p.player, skill, level: s.level, xp: s.xp };
          }
        }
      }

      if (!mostCombat || combatXP > mostCombat.xp) {
        mostCombat = { player: p.player, xp: combatXP };
      }
      if (!topSkiller || skillingXP > topSkiller.xp) {
        topSkiller = { player: p.player, xp: skillingXP };
      }
      if (levelCount > 0) {
        const avg = levelSum / levelCount;
        if (!highestAvg || avg > highestAvg.avg) {
          highestAvg = { player: p.player, avg };
        }
      }
    }

    let overallGap: null | { first: string; second: string; gap: number } =
      null;
    const ranked = overallRank
      .filter((r) => isRanked(r.xp))
      .sort((a, b) => b.xp - a.xp);
    if (ranked.length >= 2) {
      overallGap = {
        first: ranked[0].player,
        second: ranked[1].player,
        gap: ranked[0].xp - ranked[1].xp,
      };
    }

    return {
      closest,
      furthest,
      groupTotalXP,
      groupTotalLevel,
      mostCombat,
      topSkiller,
      highestAvg,
      lowestSkill,
      overallGap,
    };
  }, [players, skillOrder]);

  const ninesData = useMemo(() => {
    if (!players.length)
      return {
        tally: [] as Array<{ player: string; count99: number }>,
        next: [] as Array<{
          player: string;
          best: null | { skill: string; delta: number; level: number };
        }>,
      };

    const tally = players.map((p) => {
      const count99 = Object.entries(p.skills).filter(
        ([skill, s]) => skill !== "Overall" && s.level >= 99
      ).length;
      return { player: p.player, count99 };
    });

    const next = players.map((p) => {
      let best: null | { skill: string; delta: number; level: number } = null;

      for (const [skill, s] of Object.entries(p.skills)) {
        if (skill === "Overall") continue;
        if (s.level >= 99 || s.level === -1 || s.xp === -1) continue;

        const delta = xpTo99(s.level, s.xp);
        if (delta == null) continue;

        if (!best || delta < best.delta) {
          best = { skill, delta, level: s.level };
        }
      }

      return { player: p.player, best };
    });

    return { tally, next };
  }, [players]);

  const { rows } = useMemo(() => {
    if (!players.length || !selectedSkill) {
      return { rows: [] as Array<any> };
    }

    const base = players.map((p) => {
      const s = p.skills[selectedSkill];
      const unranked = s.rank === -1 || s.level === -1 || s.xp === -1;

      const _levelN = unranked ? Number.NEGATIVE_INFINITY : s.level;
      const _xpN = unranked ? Number.NEGATIVE_INFINITY : s.xp;
      const _rankN = unranked ? Number.POSITIVE_INFINITY : s.rank;

      return {
        player: p.player,
        level: s.level,
        xp: s.xp,
        rank: s.rank,
        unranked,
        _levelN,
        _xpN,
        _rankN,
      };
    });

    const bestFirst = [...base].sort(betterCmp);
    const groupRankMap = new Map<string, number>();
    bestFirst.forEach((r, idx) => {
      groupRankMap.set(r.player, idx + 1);
    });

    const display = [...base].sort((a, b) => {
      const cmp = betterCmp(a, b);
      return sortDir === "desc" ? cmp : -cmp;
    });

    const rowsWithRank = display.map((r) => ({
      groupRank: groupRankMap.get(r.player) ?? 0,
      ...r,
    }));

    return { rows: rowsWithRank };
  }, [players, selectedSkill, sortBy, sortDir]);

  function headerClick(col: SortKey) {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(col);
    setSortDir("desc");
  }

  function ariaSort(col: SortKey): "none" | "ascending" | "descending" {
    if (sortBy !== col) return "none";
    return sortDir === "asc" ? "ascending" : "descending";
  }

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
          <CardHeader className="text-xl flex flex-row items-center justify-between space-y-0">
            <CardTitle>The Lads' OSRS Rankings</CardTitle>

            <div className="flex items-center gap-3">
              <div className="w-auto">
                <Select
                  value={selectedSkill}
                  onValueChange={(v) => setSelectedSkill(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a skill" />
                  </SelectTrigger>

                  <SelectContent>
                    {skillOrder.map((s) => (
                      <SelectItem key={s} value={s}>
                        <div className="flex items-center gap-2">
                          <img
                            src={skillIconUrl(s)}
                            alt=""
                            width={18}
                            height={18}
                            loading="lazy"
                            className="h-4 w-4 shrink-0"
                          />
                          <span>{s}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={forceRefresh}
                disabled={loading}
                className="whitespace-nowrap"
              >
                {loading ? "Refreshing..." : "Force refresh"}
              </Button>
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
                  <TableHead className="min-w-[180px]">Player</TableHead>
                  <SortableTH col="level" className="min-w-[80px]">
                    Level
                  </SortableTH>
                  <SortableTH col="xp" className="min-w-[140px]">
                    XP
                  </SortableTH>
                  <SortableTH col="rank" className="min-w-[100px]">
                    Global Rank
                  </SortableTH>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.player}>
                    <TableCell>
                      {r.unranked ? "—" : `#${r.groupRank}`}
                    </TableCell>

                    <TableCell className="font-medium">{r.player}</TableCell>

                    <TableCell>
                      {r.unranked ? NOT_QUALIFIED : r.level}
                    </TableCell>

                    <TableCell>
                      {r.unranked ? NOT_QUALIFIED : r.xp.toLocaleString()}
                    </TableCell>

                    <TableCell>
                      {r.unranked
                        ? NOT_QUALIFIED
                        : `#${r.rank.toLocaleString()}`}
                    </TableCell>
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

        {(extra.closest || extra.furthest) && (
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 pt-10 pb-10">
              <CardContent className="space-y-3 text-sm leading-relaxed">
                {extra.closest && (
                  <div className="flex items-start gap-2">
                    <img
                      src={skillIconUrl(extra.closest.skill)}
                      alt=""
                      className="h-4 w-4 mt-0.5 shrink-0"
                    />
                    <span>
                      <span className="font-medium">
                        {extra.closest.player}
                      </span>{" "}
                      is the closest to their next level up, with{" "}
                      <span className="font-medium">
                        {extra.closest.xpToNext.toLocaleString()} XP
                      </span>{" "}
                      remaining to level{" "}
                      <span className="font-medium">
                        {extra.closest.level + 1} {extra.closest.skill}
                      </span>
                      !
                    </span>
                  </div>
                )}

                {extra.furthest && (
                  <div className="flex items-start gap-2">
                    <img
                      src={skillIconUrl(extra.furthest.skill)}
                      alt=""
                      className="h-4 w-4 mt-0.5 shrink-0"
                    />
                    <span>
                      <span className="font-medium">
                        {extra.furthest.player}
                      </span>{" "}
                      has the biggest grind ahead, needing{" "}
                      <span className="font-medium">
                        {extra.furthest.xpToNext.toLocaleString()} XP
                      </span>{" "}
                      to level{" "}
                      <span className="font-medium">
                        {extra.furthest.level + 1} {extra.furthest.skill}
                      </span>
                      .
                    </span>
                  </div>
                )}

                {extra.mostCombat && (
                  <div className="flex items-start gap-2">
                    <img
                      src={skillIconUrl("Attack")}
                      alt=""
                      className="h-4 w-4 mt-0.5 shrink-0"
                    />
                    <span>
                      <span className="font-medium">
                        {extra.mostCombat.player}
                      </span>{" "}
                      is the most combat-proficient, having{" "}
                      <span className="font-medium">
                        {extra.mostCombat.xp.toLocaleString()}
                      </span>{" "}
                      combat XP
                    </span>
                  </div>
                )}

                {extra.topSkiller && (
                  <div className="flex items-start gap-2">
                    <img
                      src={skillIconUrl("Crafting")}
                      alt=""
                      className="h-4 w-4 mt-0.5 shrink-0"
                    />
                    <span>
                      <span className="font-medium">
                        {extra.topSkiller.player}
                      </span>{" "}
                      is the top skiller, having{" "}
                      <span className="font-medium">
                        {extra.topSkiller.xp.toLocaleString()}
                      </span>{" "}
                      non-combat XP.
                    </span>
                  </div>
                )}

                {extra.highestAvg && (
                  <div className="flex items-start gap-2">
                    <img
                      src={skillIconUrl("Construction")}
                      alt=""
                      className="h-4 w-4 mt-0.5 shrink-0"
                    />
                    <span>
                      <span className="font-medium">
                        {extra.highestAvg.player}
                      </span>{" "}
                      has the highest average skill level at{" "}
                      <span className="font-medium">
                        {extra.highestAvg.avg.toFixed(2)}
                      </span>
                      .
                    </span>
                  </div>
                )}

                {extra.overallGap && (
                  <div className="flex items-start gap-2">
                    <img
                      src={skillIconUrl("Overall")}
                      alt=""
                      className="h-4 w-4 mt-0.5 shrink-0"
                    />
                    <span>
                      <span className="font-medium">
                        {extra.overallGap.first}
                      </span>{" "}
                      is beating{" "}
                      <span className="font-medium">
                        {extra.overallGap.second}
                      </span>{" "}
                      by{" "}
                      <span className="font-medium">
                        {extra.overallGap.gap.toLocaleString()}
                      </span>{" "}
                      XP.
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="pt-10 pb-10 items-center justify-center flex flex-col">
              <CardContent className="px-6 text-center flex flex-col items-center justify-center">
                {" "}
                <div className="flex flex-col items-center">
                  <img
                    src={skillIconUrl("Overall")}
                    alt=""
                    className="h-10 w-10 mb-2"
                  />
                  <div className="text-base sm:text-lg font-semibold leading-tight">
                    The Lads have a combined
                  </div>
                  <div className="mt-2 text-lg sm:text-xl font-bold text-primary">
                    {extra.groupTotalLevel.toLocaleString()} total levels
                  </div>
                  <div className="mt-1 text-lg sm:text-xl font-bold text-primary">
                    {extra.groupTotalXP.toLocaleString()} total XP
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {ninesData.tally.length > 0 && (
          <Card>
            <CardContent className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 px-3 font-semibold">Player</th>
                    <th className="py-2 px-3 font-semibold">Level 99s</th>
                    <th className="py-2 px-3 font-semibold">Closest Next 99</th>
                  </tr>
                </thead>

                <tbody>
                  {ninesData.tally
                    .sort(
                      (a, b) =>
                        b.count99 - a.count99 ||
                        a.player.localeCompare(b.player)
                    )
                    .map((n) => {
                      const nextInfo = ninesData.next.find(
                        (x) => x.player === n.player
                      )?.best;

                      const playerData = players.find(
                        (p) => p.player === n.player
                      );
                      const skillsAt99 = playerData
                        ? skillOrder.filter(
                            (s) =>
                              s !== "Overall" &&
                              playerData.skills[s]?.level >= 99
                          )
                        : [];

                      return (
                        <tr key={n.player} className="border-b last:border-0">
                          <td className="py-2 px-3 font-medium">{n.player}</td>

                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <span>{n.count99}</span>
                              <div className="flex flex-wrap gap-1">
                                {skillsAt99.map((s) => (
                                  <img
                                    key={s}
                                    src={skillIconUrl(s)}
                                    alt={`${s} 99`}
                                    width={16}
                                    height={16}
                                    loading="lazy"
                                    className="h-4 w-4 rounded-sm"
                                  />
                                ))}
                              </div>
                            </div>
                          </td>

                          <td className="py-2 px-3">
                            {nextInfo ? (
                              <div className="flex items-center gap-2">
                                <img
                                  src={skillIconUrl(nextInfo.skill)}
                                  alt={`${nextInfo.skill} icon`}
                                  width={16}
                                  height={16}
                                  loading="lazy"
                                  className="h-4 w-4 rounded-sm"
                                />
                                <span>
                                  {nextInfo.skill} ({nextInfo.level}→99) -{" "}
                                  <span className="font-medium">
                                    {nextInfo.delta.toLocaleString()} XP
                                  </span>{" "}
                                  remaining
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">
                                All 99 or unranked
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>

      <footer className="mt-10 flex justify-center gap-4">
        <Button
          asChild
          size="lg"
          className="text-base font-medium transition-transform duration-250 hover:scale-95"
        >
          <a
            href="https://tinyurl.com/yc2f7m4j"
            target="_blank"
            rel="noopener noreferrer"
          >
            💰 Click here for free OSRS GP
          </a>
        </Button>

        <Button
          asChild
          size="lg"
          variant="secondary"
          className="text-base font-medium transition-transform duration-250 hover:scale-95"
        >
          <a
            href="https://oldschool.runescape.wiki/w/Pay-to-play_Fishing_training"
            target="_blank"
            rel="noopener noreferrer"
          >
            🎣 How to get good at RuneScape
          </a>
        </Button>
      </footer>
    </main>
  );
}
