/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @next/next/no-img-element */

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

function norm(p: string) {
  return p.trim().toLowerCase();
}

export async function POST(req: NextRequest) {

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const players = Array.isArray((body as any).players) ? (body as any).players : null;

  if (players?.length) {
    for (const p of players) revalidateTag(`osrs:${norm(p)}`);
  } else {
    revalidateTag("osrs");
  }

  return NextResponse.json({ ok: true });
}
