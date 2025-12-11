/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @next/next/no-img-element */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username");
    const skill = searchParams.get("skill");

    if (!username || !skill) {
      return NextResponse.json(
        { error: "username and skill are required" },
        { status: 400 }
      );
    }

    const player = await prisma.player.findUnique({
      where: { username },
    });

    if (!player) {
      return NextResponse.json({ points: [] }, { status: 200 });
    }

    const snapshots = await prisma.snapshot.findMany({
      where: { playerId: player.id },
      orderBy: { recordedAt: "asc" },
    });

    const points = snapshots.map((snap) => {
      const data: any = snap.data;
      const skillData = data.skills?.[skill] ?? {};
      return {
        timestamp: snap.recordedAt,
        exp: skillData.xp ?? 0,
        level: skillData.level ?? 1,
        rank: skillData.rank ?? null,
      };
    });

    return NextResponse.json({ points }, { status: 200 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
