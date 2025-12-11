/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @next/next/no-img-element */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchOsrsStats } from "@/lib/osrs";
import { TRACKED_PLAYERS } from "@/lib/tracked-players";

export async function POST() {
  try {
    const results = [];

    for (const username of TRACKED_PLAYERS) {
      try {
        const data = await fetchOsrsStats(username);

        const player = await prisma.player.upsert({
          where: { username },
          update: {},
          create: { username },
        });

        await prisma.snapshot.create({
          data: {
            playerId: player.id,
            data,
          },
        });

        results.push({ username, ok: true });
      } catch (err: any) {
        console.error(`Snapshot failed for ${username}`, err);
        results.push({ username, ok: false, error: err.message });
      }
    }

    return NextResponse.json({ ok: true, results }, { status: 200 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { ok: false, error: err.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
