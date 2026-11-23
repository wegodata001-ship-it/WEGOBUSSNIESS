import { NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/auth/cron-auth";
import { runNotificationJobs } from "@/lib/notify/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 401 });
  }
  const summary = await runNotificationJobs();
  return NextResponse.json({ ok: true, summary });
}

export async function POST(request: Request) {
  return GET(request);
}
