import { NextResponse } from "next/server";
import { listProjectMaintenanceLogs } from "@/lib/admin/project-system-assets";
import { requireActor } from "@/lib/auth/server-actor";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const businessId = new URL(request.url).searchParams.get("businessId")?.trim() ?? "";
  if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });
  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  const result = await listProjectMaintenanceLogs(resolved.actor!, resolved.actor!.businessId, projectId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, logs: result.logs });
}
