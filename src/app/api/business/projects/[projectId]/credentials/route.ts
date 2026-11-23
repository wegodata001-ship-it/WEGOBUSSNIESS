import { NextResponse } from "next/server";
import {
  deleteProjectCredential,
  getProjectCredentialStatus,
  revealProjectCredential,
  saveProjectCredential,
} from "@/lib/admin/project-credentials";
import { requireActor } from "@/lib/auth/server-actor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
};

function businessIdOf(request: Request) {
  return new URL(request.url).searchParams.get("businessId")?.trim() ?? "";
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const businessId = businessIdOf(request);
  if (!businessId) return json({ error: "MISSING_BUSINESS" }, 400);
  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) {
    resolved.error.headers.set("Cache-Control", NO_STORE["Cache-Control"]);
    return resolved.error;
  }
  const result = await getProjectCredentialStatus({
    actor: resolved.actor!,
    businessId: resolved.actor!.businessId,
    projectId,
  });
  if (!result.ok) return json({ error: result.error }, result.status);
  return json({
    ok: true,
    encryptionReady: result.encryptionReady,
    configured: result.configured,
  });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const body = await request.json().catch(() => ({})) as {
    businessId?: string;
    password?: unknown;
    accountPassword?: unknown;
  };
  const businessId = (body.businessId ?? businessIdOf(request)).trim();
  if (!businessId) return json({ error: "MISSING_BUSINESS" }, 400);
  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;

  const result = await saveProjectCredential({
    actor: resolved.actor!,
    businessId: resolved.actor!.businessId,
    projectId,
    password: body.password,
    accountPassword: body.accountPassword,
  });
  if (!result.ok) return json({ error: result.error }, result.status);
  return json({ ok: true, configured: true });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const body = await request.json().catch(() => ({})) as {
    businessId?: string;
    action?: string;
    accountPassword?: unknown;
  };
  const businessId = (body.businessId ?? businessIdOf(request)).trim();
  if (!businessId) return json({ error: "MISSING_BUSINESS" }, 400);
  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;

  if (body.action !== "reveal") {
    return json({ error: "UNKNOWN_ACTION" }, 400);
  }

  const result = await revealProjectCredential({
    actor: resolved.actor!,
    businessId: resolved.actor!.businessId,
    projectId,
    accountPassword: body.accountPassword,
  });
  if (!result.ok) return json({ error: result.error }, result.status);
  return json({ ok: true, password: result.password });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const body = await request.json().catch(() => ({})) as {
    businessId?: string;
    accountPassword?: unknown;
  };
  const businessId = (body.businessId ?? businessIdOf(request)).trim();
  if (!businessId) return json({ error: "MISSING_BUSINESS" }, 400);
  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;

  const result = await deleteProjectCredential({
    actor: resolved.actor!,
    businessId: resolved.actor!.businessId,
    projectId,
    accountPassword: body.accountPassword,
  });
  if (!result.ok) return json({ error: result.error }, result.status);
  return json({ ok: true, configured: false });
}
