import { NextResponse } from "next/server";
import { runNotificationJobs } from "@/lib/notify/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  const header = request.headers.get("authorization") ?? "";
  if (secret && header === `Bearer ${secret}`) return true;
  if (request.headers.get("x-vercel-cron") === "1") return true;
  return false;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 401 });
  const summary = await runNotificationJobs();
  return NextResponse.json({ ok: true, summary });
}

export async function POST(request: Request) {
  return GET(request);
}
