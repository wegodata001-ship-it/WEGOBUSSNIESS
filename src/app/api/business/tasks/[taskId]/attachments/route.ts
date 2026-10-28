import { NextResponse } from "next/server";
import { listTaskAttachments, uploadTaskAttachment } from "@/lib/admin/task-assets";
import { requireActor } from "@/lib/auth/server-actor";
import { classifyStorageError, safeStorageLog } from "@/lib/firebase/admin-storage";

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
  context: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await context.params;
  const businessId = businessIdOf(request);
  if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });
  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  const result = await listTaskAttachments(resolved.actor!, resolved.actor!.businessId, taskId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, attachments: result.attachments });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const { taskId } = await context.params;
    const form = await request.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "INVALID_FORM" }, { status: 400 });
    const businessId = businessIdOf(request, form);
    if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });
    const resolved = await requireActor(request, businessId);
    if ("error" in resolved && resolved.error) return resolved.error;
    const files = form.getAll("file").filter(isUploadedFile);
    if (!files.length) return NextResponse.json({ error: "FILE_REQUIRED" }, { status: 400 });
    safeStorageLog("upload_start", {
      requestId,
      fileCount: files.length,
      hasTaskId: Boolean(taskId),
      hasBusiness: Boolean(resolved.actor!.businessId),
    });
    const ids: string[] = [];
    for (const file of files) {
      const result = await uploadTaskAttachment({
        actor: resolved.actor!,
        businessId: resolved.actor!.businessId,
        taskId,
        file,
        name: String(form.get("name") ?? ""),
        requestId,
      });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      ids.push(result.id);
    }
    return NextResponse.json({ ok: true, ids, id: ids[0] });
  } catch (error) {
    const kind = classifyStorageError(error);
    safeStorageLog("upload_unhandled", {
      requestId,
      errorType: kind,
      errorName: error instanceof Error ? error.name : "Error",
    });
    return NextResponse.json({ error: kind }, { status: kind === "STORAGE_FORBIDDEN" ? 403 : 500 });
  }
}
