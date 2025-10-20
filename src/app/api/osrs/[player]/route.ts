/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @next/next/no-img-element */

import { NextRequest, NextResponse } from "next/server";

export const revalidate = 900;

const SKILLS = [
  "Overall","Attack","Defence","Strength","Hitpoints","Ranged","Prayer","Magic",
  "Cooking","Woodcutting","Fletching","Fishing","Firemaking","Crafting","Smithing","Mining",
  "Herblore","Agility","Thieving","Slayer","Farming","Runecraft","Hunter","Construction",
] as const;

function sanitizeRSN(rsn: string) {
  return rsn.trim().replace(/\s+/g, "+");
}

function parseIndexLite(csv: string) {
  const lines = csv.trim().split("\n");
  const skillsOnly = lines.slice(0, SKILLS.length);
  const skills: Record<string, { rank: number; level: number; xp: number }> = {};
  skillsOnly.forEach((line, i) => {
    const [rank, level, xp] = line.split(",").map(Number);
    skills[SKILLS[i]] = { rank, level, xp };
  });
  return { skills, order: SKILLS };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ player: string }> }
) {
  const { player } = await params;
  const url = `https://secure.runescape.com/m=hiscore_oldschool/index_lite.ws?player=${sanitizeRSN(
    player
  )}`;

  const res = await fetch(url, {
    next: {
      revalidate: 3600,
      tags: ["osrs", `osrs:${player.toLowerCase()}`],
    },
  });

  if (!res.ok) {
    return NextResponse.json({ error: `Upstream error ${res.status}` }, { status: 502 });
  }

  const csv = await res.text();
  const data = parseIndexLite(csv);
  return NextResponse.json({ player, ...data }, { status: 200 });
}
