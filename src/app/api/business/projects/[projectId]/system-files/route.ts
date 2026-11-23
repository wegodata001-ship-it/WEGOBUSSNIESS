import { NextResponse } from "next/server";
import {
  deleteProjectSystemFile,
  listProjectSystemFiles,
  projectSystemFileDownloadUrl,
  uploadProjectSystemFile,
} from "@/lib/admin/project-system-assets";
import { requireActor } from "@/lib/auth/server-actor";

void process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
void process.env.FIREBASE_STORAGE_BUCKET;

function businessIdOf(request: Request, form?: FormData | null) {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("businessId")?.trim() ?? "";
  const fromForm = form ? String(form.get("businessId") ?? "").trim() : "";
  return fromForm || fromQuery;
}

function isUploadedFile(value: FormDataEntryValue): value is File {
  if (typeof File !== "undefined" && value instanceof File) return value.size > 0;
  if (typeof Blob !== "undefined" && value instanceof Blob && "name" in value) {
    return value.size > 0;
  }
  return false;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const url = new URL(request.url);
  const businessId = businessIdOf(request);
  if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });
  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;

  const fileId = url.searchParams.get("fileId")?.trim() ?? "";
  if (fileId) {
    const result = await projectSystemFileDownloadUrl({
      actor: resolved.actor!,
      businessId: resolved.actor!.businessId,
      projectId,
      fileId,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true, url: result.url });
  }

  const result = await listProjectSystemFiles(resolved.actor!, resolved.actor!.businessId, projectId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, files: result.files });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "INVALID_FORM" }, { status: 400 });
  const businessId = businessIdOf(request, form);
  if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });
  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  const fileEntry = form.get("file");
  if (!fileEntry || !isUploadedFile(fileEntry)) return NextResponse.json({ error: "FILE_REQUIRED" }, { status: 400 });
  const result = await uploadProjectSystemFile({
    actor: resolved.actor!,
    businessId: resolved.actor!.businessId,
    projectId,
    file: fileEntry,
    name: String(form.get("name") ?? ""),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, id: result.id });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const url = new URL(request.url);
  const businessId = businessIdOf(request);
  const fileId = url.searchParams.get("fileId")?.trim() ?? "";
  if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });
  if (!fileId) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  const result = await deleteProjectSystemFile({
    actor: resolved.actor!,
    businessId: resolved.actor!.businessId,
    projectId,
    fileId,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
