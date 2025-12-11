/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @next/next/no-img-element */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const playersParam = searchParams.get("players");
  const skill = searchParams.get("skill");

  if (!playersParam || !skill) {
    return NextResponse.json(
      { error: "players and skill are required" },
      { status: 400 }
    );
  }

  const usernames = playersParam
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);

  if (!usernames.length) {
    return NextResponse.json({ series: {} }, { status: 200 });
  }

  // 1) Fetch players by username
  const players = await prisma.player.findMany({
    where: { username: { in: usernames } },
    select: { id: true, username: true },
  });

  if (!players.length) {
    return NextResponse.json({ series: {} }, { status: 200 });
  }

  const idByUsername = new Map(players.map((p) => [p.username, p.id]));

  // 2) Fetch all snapshots for these players
  const snapshots = await prisma.snapshot.findMany({
    where: {
      playerId: { in: players.map((p) => p.id) },
    },
    orderBy: { recordedAt: "asc" },
  });

  // 3) Group snapshots by playerId
  const snapsByPlayerId = new Map<number, typeof snapshots>();

  for (const snap of snapshots) {
    const arr = snapsByPlayerId.get(snap.playerId);
    if (arr) arr.push(snap);
    else snapsByPlayerId.set(snap.playerId, [snap]);
  }

  // 4) Build series map: { username: TimeseriesPoint[] }
  const series: Record<
    string,
    {
      points: {
        timestamp: string;
        exp: number;
        level: number;
        rank: number | null;
      }[];
    }
  > = {};

  for (const username of usernames) {
    const playerId = idByUsername.get(username);
    if (!playerId) continue;

    const snaps = snapsByPlayerId.get(playerId) ?? [];
    const points = snaps.map((snap) => {
      const data: any = snap.data;
      const skillData = data.skills?.[skill] ?? {};

      return {
        timestamp: snap.recordedAt.toISOString(),
        exp: skillData.xp ?? 0,
        level: skillData.level ?? 1,
        rank: skillData.rank ?? null,
      };
    });

    series[username] = { points };
  }

  return NextResponse.json({ series }, { status: 200 });
}
