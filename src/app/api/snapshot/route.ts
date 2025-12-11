/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @next/next/no-img-element */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchOsrsStats } from "@/lib/osrs";

export async function POST(req: Request) {
  try {
    const { username } = await req.json();
    if (!username) {
      return NextResponse.json(
        { error: "username is required" },
        { status: 400 }
      );
    }
    const player = await prisma.player.upsert({
      where: { username },
      update: {},
      create: { username },
    });
    const stats = await fetchOsrsStats(username);
    await prisma.snapshot.create({
      data: {
        playerId: player.id,
        data: stats,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}