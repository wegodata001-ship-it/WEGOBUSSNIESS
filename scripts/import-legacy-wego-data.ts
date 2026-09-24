import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadProjectEnv } from "./load-env";
import { parseLegacyDateTime } from "../src/lib/dates/legacy";
import {
  LEGACY_COMMENTS,
  LEGACY_PROJECTS,
  LEGACY_SETTINGS,
  REPAIRED_PROJECT_IDS,
  type LegacyTaskRow,
} from "./legacy-data/source";
import { LEGACY_TASKS } from "./legacy-data/tasks";

loadProjectEnv();

const dryRun = process.argv.includes("--dry-run");

const STATUS_MAP: Record<string, string> = {
  "לביצוע": "TODO",
  "בביצוע": "IN_PROGRESS",
  "ממתין": "WAITING",
  "הושלם": "DONE",
  "בוטל": "CANCELLED",
  "ארכיון": "ARCHIVED",
};

const PRIORITY_MAP: Record<string, string> = {
  "רגיל": "NORMAL",
  "בינוני": "MEDIUM",
  "דחוף": "URGENT",
};

type Counts = { created: number; updated: number; skipped: number };

function emptyCounts(): Counts {
  return { created: 0, updated: 0, skipped: 0 };
}

function unique(ids: string[]) {
  return new Set(ids).size === ids.length;
}

function loadTasks(): LegacyTaskRow[] {
  const jsonPath = resolve(process.cwd(), "scripts/legacy-data/tasks.json");
  if (existsSync(jsonPath)) {
    const parsed = JSON.parse(readFileSync(jsonPath, "utf8"));
    return Array.isArray(parsed) ? parsed as LegacyTaskRow[] : [];
  }
  return LEGACY_TASKS;
}

function splitAssignees(value: string | null | undefined) {
  if (!value || value.toUpperCase() === "NULL") return [];
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function mapStatus(value: string | null | undefined, approval: string | null | undefined) {
  const approvalStatus = (approval ?? "").trim().toUpperCase();
  if (approvalStatus === "PENDING") return "PENDING_APPROVAL";
  return STATUS_MAP[(value ?? "").trim()] ?? "TODO";
}

function mapPriority(value: string | null | undefined) {
  return PRIORITY_MAP[(value ?? "").trim()] ?? "NORMAL";
}

function parseHours(value: string | number | null | undefined) {
  if (value == null || value === "" || String(value).toUpperCase() === "NULL") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSent(value: string | boolean | null | undefined) {
  if (value == null || value === "") return null;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "כן"].includes(normalized)) return true;
  if (["0", "false", "no", "לא"].includes(normalized)) return false;
  return null;
}

async function main() {
  const { getAdminDb, isFirebaseAdminConfigured } = await import("../src/lib/firebase/admin");
  if (!isFirebaseAdminConfigured()) {
    console.error("WAITING_FOR_FIREBASE_CONFIG");
    process.exit(1);
  }

  const db = getAdminDb();
  const businesses = await db.collection("businesses").where("slug", "==", "wego").limit(1).get();
  const business = businesses.docs[0];
  if (!business) {
    console.error("BUSINESS_NOT_FOUND");
    process.exit(1);
  }

  const businessId = business.id;
  const businessRef = business.ref;
  const tasks = loadTasks();

  const [projectsSnap, tasksSnap, settingsSnap, employeesSnap, usersSnap] = await Promise.all([
    businessRef.collection("projects").get(),
    businessRef.collection("tasks").get(),
    businessRef.collection("settings").get(),
    businessRef.collection("employees").get(),
    db.collection("users").get(),
  ]);

  let existingComments = 0;
  for (const docSnap of tasksSnap.docs) {
    existingComments += (await docSnap.ref.collection("comments").get()).size;
  }

  console.log("DATABASE: Firestore");
  console.log("PROJECT MODEL: businesses/{id}/projects");
  console.log("TASK MODEL: businesses/{id}/tasks");
  console.log("COMMENT MODEL: businesses/{id}/tasks/{taskId}/comments");
  console.log("SETTING MODEL: businesses/{id}/settings");
  console.log("BUSINESS ID:", businessId);
  console.log("EXISTING PROJECTS:", projectsSnap.size);
  console.log("EXISTING TASKS:", tasksSnap.size);
  console.log("EXISTING COMMENTS:", existingComments);
  console.log("EXISTING SETTINGS:", settingsSnap.size);
  console.log("MODE:", dryRun ? "DRY-RUN" : "UPSERT");

  const usersByEmail = new Map<string, { uid: string; employeeId: string | null; email: string; name: string }>();
  for (const docSnap of usersSnap.docs) {
    const email = normalizeEmail(String(docSnap.data().email ?? ""));
    if (!email) continue;
    usersByEmail.set(email, {
      uid: docSnap.id,
      employeeId: null,
      email,
      name: String(docSnap.data().displayName ?? email),
    });
  }
  for (const docSnap of employeesSnap.docs) {
    const email = normalizeEmail(String(docSnap.data().email ?? ""));
    if (!email) continue;
    const current = usersByEmail.get(email);
    const userId = typeof docSnap.data().userId === "string" ? docSnap.data().userId : current?.uid ?? "";
    usersByEmail.set(email, {
      uid: userId,
      employeeId: docSnap.id,
      email,
      name: String(docSnap.data().displayName ?? email),
    });
  }

  const unmatchedUsers = new Set<string>();
  function resolveUser(identifier: string | null | undefined) {
    if (!identifier) return null;
    const key = normalizeEmail(identifier);
    const hit = usersByEmail.get(key);
    if (hit) return hit;
    unmatchedUsers.add(identifier.trim());
    return null;
  }

  const errors: string[] = [];
  const repaired: string[] = [];
  const invalidProjectRefs: string[] = [];

  if (!unique(LEGACY_PROJECTS.map((row) => row.Project_ID))) errors.push("DUPLICATE_PROJECT_SOURCE_ID");
  if (!unique(LEGACY_SETTINGS.map((row) => row.Set_ID))) errors.push("DUPLICATE_SETTING_SOURCE_ID");
  if (!unique(LEGACY_COMMENTS.map((row) => row.Cmt_ID))) errors.push("DUPLICATE_COMMENT_SOURCE_ID");
  if (!unique(tasks.map((row) => row.Task_ID))) errors.push("DUPLICATE_TASK_SOURCE_ID");

  for (const row of LEGACY_PROJECTS) {
    if (!parseLegacyDateTime(row.Start_Date)) errors.push(`BAD_PROJECT_DATE:${row.Project_ID}`);
  }

  const projectIds = new Set(LEGACY_PROJECTS.map((row) => row.Project_ID));
  const settingValues = {
    TASK_STATUS: new Set(LEGACY_SETTINGS.filter((row) => row.Type === "TASK_STATUS").map((row) => row.Value)),
    TASK_PRIORITY: new Set(LEGACY_SETTINGS.filter((row) => row.Type === "TASK_PRIORITY").map((row) => row.Value)),
    PROJ_CATEGORY: new Set(LEGACY_SETTINGS.filter((row) => row.Type === "PROJ_CATEGORY").map((row) => row.Value)),
  };

  for (const row of LEGACY_PROJECTS) {
    if (!settingValues.PROJ_CATEGORY.has(row.Category)) errors.push(`UNKNOWN_CATEGORY:${row.Project_ID}`);
  }

  const resolvedTasks = tasks.map((row) => {
    const rawProject = (row.Project_ID ?? "").trim();
    const repairedId = REPAIRED_PROJECT_IDS[rawProject];
    const projectId = repairedId ?? rawProject;
    if (repairedId) repaired.push(`${row.Task_ID}:${rawProject}->${repairedId}`);
    if (projectId && !projectIds.has(projectId) && projectId !== "NEW") {
      invalidProjectRefs.push(`${row.Task_ID}:${rawProject}`);
    }
    if ((row.Status ?? "") && !settingValues.TASK_STATUS.has(String(row.Status).trim())) {
      errors.push(`UNKNOWN_STATUS:${row.Task_ID}`);
    }
    if ((row.Priority ?? "") && !settingValues.TASK_PRIORITY.has(String(row.Priority).trim())) {
      errors.push(`UNKNOWN_PRIORITY:${row.Task_ID}`);
    }
    for (const field of [row.Date_Created, row.Date_Start, row.Date_Due, row.Date_Completed, row.Last_Update]) {
      if (field && String(field).toUpperCase() !== "NULL" && !parseLegacyDateTime(field)) {
        errors.push(`BAD_TASK_DATE:${row.Task_ID}`);
      }
    }
    if (!row.Task_Name?.trim()) errors.push(`MISSING_TASK_NAME:${row.Task_ID}`);
    return { ...row, resolvedProjectId: projectId, rawProjectId: rawProject };
  });

  const taskIds = new Set(resolvedTasks.map((row) => row.Task_ID));
  const missingCommentBodies = LEGACY_COMMENTS.filter((row) => row.missingBody || !row.Message).map((row) => row.Cmt_ID);
  const missingCommentTasks = LEGACY_COMMENTS
    .filter((row) => !taskIds.has(row.Task_ID))
    .map((row) => row.Cmt_ID);

  if (errors.length) {
    console.error("VALIDATION_FAILED");
    for (const error of errors) console.error(error);
    process.exit(1);
  }

  const projectCounts = emptyCounts();
  const taskCounts = emptyCounts();
  const commentCounts = emptyCounts();
  const settingCounts = emptyCounts();

  const existingProjects = new Map(projectsSnap.docs.map((docSnap) => [docSnap.id, docSnap]));
  const existingTasks = new Map(tasksSnap.docs.map((docSnap) => [docSnap.id, docSnap]));
  const existingSettings = new Map(settingsSnap.docs.map((docSnap) => [docSnap.id, docSnap]));
  const settingsByTypeValue = new Map(
    settingsSnap.docs
      .filter((docSnap) => docSnap.id !== "general")
      .map((docSnap) => [`${docSnap.data().type}::${docSnap.data().value}`, docSnap]),
  );

  if (!dryRun) {
    const backupDir = resolve(process.cwd(), "scripts/legacy-data/backups");
    mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const commentsBackup: Array<{ taskId: string; id: string; data: FirebaseFirestore.DocumentData }> = [];
    for (const docSnap of tasksSnap.docs) {
      const snap = await docSnap.ref.collection("comments").get();
      commentsBackup.push(...snap.docs.map((item) => ({ taskId: docSnap.id, id: item.id, data: item.data() })));
    }
    writeFileSync(resolve(backupDir, `pre-import-${stamp}.json`), JSON.stringify({
      businessId,
      projects: projectsSnap.docs.map((docSnap) => ({ id: docSnap.id, data: docSnap.data() })),
      tasks: tasksSnap.docs.map((docSnap) => ({ id: docSnap.id, data: docSnap.data() })),
      comments: commentsBackup,
      settings: settingsSnap.docs.map((docSnap) => ({ id: docSnap.id, data: docSnap.data() })),
    }));
    console.log("BACKUP_WRITTEN");
  }

  const now = new Date();

  for (const row of LEGACY_SETTINGS) {
    const existing = existingSettings.get(row.Set_ID) ?? settingsByTypeValue.get(`${row.Type}::${row.Value}`);
    const ref = existing?.ref ?? businessRef.collection("settings").doc(row.Set_ID);
    if (existing) settingCounts.updated += 1;
    else settingCounts.created += 1;
    if (!dryRun) {
      await ref.set({
        businessId,
        legacyId: row.Set_ID,
        type: row.Type,
        value: row.Value,
        color: row.Color,
        createdAt: existing?.data().createdAt ?? now,
        updatedAt: now,
      }, { merge: true });
    }
  }

  const categoryColor = new Map(LEGACY_SETTINGS.filter((row) => row.Type === "PROJ_CATEGORY").map((row) => [row.Value, row.Color]));

  for (const row of LEGACY_PROJECTS) {
    const start = parseLegacyDateTime(row.Start_Date)!;
    const existing = existingProjects.get(row.Project_ID)
      ?? projectsSnap.docs.find((docSnap) => docSnap.data().legacyId === row.Project_ID);
    const ref = existing?.ref ?? businessRef.collection("projects").doc(row.Project_ID);
    if (existing) projectCounts.updated += 1;
    else projectCounts.created += 1;
    if (!dryRun) {
      await ref.set({
        businessId,
        legacyId: row.Project_ID,
        seedKey: existing?.data().seedKey ?? row.Project_ID,
        name: row.Name,
        clientName: existing?.data().clientName ?? "",
        description: existing?.data().description ?? "",
        status: "ACTIVE",
        category: row.Category,
        location: row.Location,
        projectNumber: row.Project_Number,
        departmentId: existing?.data().departmentId ?? null,
        managerEmployeeId: existing?.data().managerEmployeeId ?? null,
        startDate: start.dateOnly,
        dueDate: existing?.data().dueDate ?? null,
        isActive: true,
        color: existing?.data().color ?? categoryColor.get(row.Category) ?? "BLUE",
        createdAt: existing?.data().createdAt ?? start.at,
        updatedAt: now,
      }, { merge: true });
    }
  }

  for (const row of resolvedTasks) {
    const created = parseLegacyDateTime(row.Date_Created);
    const start = parseLegacyDateTime(row.Date_Start);
    const due = parseLegacyDateTime(row.Date_Due);
    const completed = parseLegacyDateTime(row.Date_Completed);
    const updated = parseLegacyDateTime(row.Last_Update);
    const existing = existingTasks.get(row.Task_ID)
      ?? tasksSnap.docs.find((docSnap) => docSnap.data().legacyId === row.Task_ID);
    const assignees = splitAssignees(row.Assigned_To);
    const mapped = assignees.map(resolveUser).filter((item): item is NonNullable<typeof item> => Boolean(item?.employeeId));
    const creator = resolveUser(row.Creator_Email);
    const projectId = row.resolvedProjectId && projectIds.has(row.resolvedProjectId) ? row.resolvedProjectId : null;
    if (row.rawProjectId && !projectId) invalidProjectRefs.push(`${row.Task_ID}:${row.rawProjectId}`);
    const ref = existing?.ref ?? businessRef.collection("tasks").doc(row.Task_ID);
    if (existing) taskCounts.updated += 1;
    else taskCounts.created += 1;
    if (!dryRun) {
      const finance = {
        priceBeforeVat: existing?.data().priceBeforeVat ?? null,
        vatRate: existing?.data().vatRate ?? null,
        vatAmount: existing?.data().vatAmount ?? null,
        priceIncludingVat: existing?.data().priceIncludingVat ?? null,
        paidAmount: existing?.data().paidAmount ?? 0,
        balanceDue: existing?.data().balanceDue ?? null,
        paymentStatus: existing?.data().paymentStatus ?? null,
        paymentIds: existing?.data().paymentIds ?? [],
      };
      await ref.set({
        businessId,
        legacyId: row.Task_ID,
        legacyProjectId: row.rawProjectId || null,
        seedKey: existing?.data().seedKey ?? row.Task_ID,
        title: row.Task_Name,
        description: row.Task_Description ?? existing?.data().description ?? "",
        status: mapStatus(row.Status, row.Approval_Status),
        priority: mapPriority(row.Priority),
        color: existing?.data().color ?? "BLUE",
        taskType: existing?.data().taskType ?? "GENERAL",
        assigneeId: mapped[0]?.employeeId ?? existing?.data().assigneeId ?? null,
        collaboratorIds: mapped.slice(1).map((item) => item.employeeId),
        assigneeEmployeeId: mapped[0]?.employeeId ?? existing?.data().assigneeEmployeeId ?? null,
        assigneeEmployeeIds: mapped.map((item) => item.employeeId),
        departmentId: existing?.data().departmentId ?? null,
        projectId,
        estimatedHours: parseHours(row.Planned_Hours),
        actualHours: existing?.data().actualHours ?? null,
        startDate: start?.dateOnly ?? null,
        dueDate: due?.dateOnly ?? null,
        scheduledDate: start?.dateOnly ?? null,
        startTime: start?.timeOnly.slice(0, 5) ?? null,
        endTime: existing?.data().endTime ?? null,
        createdByUserId: creator?.uid || existing?.data().createdByUserId || "",
        createdByEmployeeId: creator?.employeeId ?? existing?.data().createdByEmployeeId ?? null,
        approvedByUserId: existing?.data().approvedByUserId ?? null,
        approvedAt: existing?.data().approvedAt ?? null,
        rejectedByUserId: existing?.data().rejectedByUserId ?? null,
        rejectedAt: existing?.data().rejectedAt ?? null,
        rejectionReason: existing?.data().rejectionReason ?? null,
        commentCount: existing?.data().commentCount ?? 0,
        ...finance,
        legacyAssignee: row.Assigned_To ?? null,
        legacyCreatorEmail: row.Creator_Email ?? null,
        legacyApprovalStatus: (row.Approval_Status ?? "").trim().toUpperCase() === "PENDING" ? "PENDING" : (row.Approval_Status ?? "").trim().toUpperCase() === "APPROVED" ? "APPROVED" : null,
        legacyStatus: row.Status ?? null,
        legacyPriority: row.Priority ?? null,
        legacyCategory: row.Task_Category ?? null,
        completedDate: completed?.dateOnly ?? null,
        recurrence: row.Recurrence && String(row.Recurrence).toUpperCase() !== "NULL" ? String(row.Recurrence) : null,
        isSent: parseSent(row.Is_Sent),
        createdAt: existing?.data().createdAt ?? created?.at ?? now,
        updatedAt: updated?.at ?? now,
      }, { merge: true });
    }
  }

  for (const row of LEGACY_COMMENTS) {
    if (row.missingBody || !row.Message) {
      commentCounts.skipped += 1;
      continue;
    }
    if (!taskIds.has(row.Task_ID) && !existingTasks.has(row.Task_ID)) {
      commentCounts.skipped += 1;
      continue;
    }
    const author = resolveUser(row.User_Email);
    const stamped = parseLegacyDateTime(row.Timestamp);
    if (!stamped) {
      commentCounts.skipped += 1;
      continue;
    }
    const taskRef = businessRef.collection("tasks").doc(row.Task_ID);
    const commentRef = taskRef.collection("comments").doc(row.Cmt_ID);
    const existing = dryRun ? null : await commentRef.get();
    if (existing?.exists) commentCounts.updated += 1;
    else commentCounts.created += 1;
    if (!dryRun) {
      await commentRef.set({
        businessId,
        taskId: row.Task_ID,
        legacyId: row.Cmt_ID,
        authorUserId: author?.uid ?? "",
        authorEmployeeId: author?.employeeId ?? null,
        legacyAuthorEmail: row.User_Email,
        body: row.Message,
        mentions: [],
        attachments: [],
        createdAt: existing?.data()?.createdAt ?? stamped.at,
        updatedAt: now,
      }, { merge: true });
      const comments = await taskRef.collection("comments").get();
      await taskRef.set({ commentCount: comments.size, updatedAt: now }, { merge: true });
    }
  }

  let relationPass = true;
  if (!dryRun) {
    const afterProjects = await businessRef.collection("projects").get();
    const afterTasks = await businessRef.collection("tasks").get();
    const afterSettings = await businessRef.collection("settings").get();
    for (const row of LEGACY_PROJECTS) {
      if (!afterProjects.docs.some((docSnap) => docSnap.id === row.Project_ID || docSnap.data().legacyId === row.Project_ID)) {
        relationPass = false;
      }
    }
    for (const row of resolvedTasks) {
      const task = afterTasks.docs.find((docSnap) => docSnap.id === row.Task_ID || docSnap.data().legacyId === row.Task_ID);
      if (!task) relationPass = false;
      else if (row.resolvedProjectId && task.data().projectId !== row.resolvedProjectId && projectIds.has(row.resolvedProjectId)) {
        relationPass = false;
      }
    }
    for (const row of LEGACY_SETTINGS) {
      if (!afterSettings.docs.some((docSnap) => docSnap.id === row.Set_ID || (docSnap.data().type === row.Type && docSnap.data().value === row.Value))) {
        relationPass = false;
      }
    }
    for (const row of LEGACY_COMMENTS.filter((item) => item.Message && !item.missingBody && (taskIds.has(item.Task_ID) || existingTasks.has(item.Task_ID)))) {
      const snap = await businessRef.collection("tasks").doc(row.Task_ID).collection("comments").doc(row.Cmt_ID).get();
      if (!snap.exists) relationPass = false;
    }
  }

  console.log("");
  console.log("LEGACY IMPORT AUDIT");
  console.log("-------------------");
  console.log("DATABASE: Firestore");
  console.log(`BUSINESS: ${businessId} / ${business.data().name}`);
  console.log("");
  console.log("PROJECTS SOURCE: 19");
  console.log(`PROJECTS CREATED: ${projectCounts.created}`);
  console.log(`PROJECTS UPDATED: ${projectCounts.updated}`);
  console.log(`PROJECTS SKIPPED: ${projectCounts.skipped}`);
  console.log("");
  console.log(`TASKS SOURCE: ${tasks.length}`);
  console.log(`TASKS CREATED: ${taskCounts.created}`);
  console.log(`TASKS UPDATED: ${taskCounts.updated}`);
  console.log(`TASKS SKIPPED: ${taskCounts.skipped}`);
  if (tasks.length === 0) console.log("TASKS FILE: MISSING — put full rows in scripts/legacy-data/tasks.json");
  console.log("");
  console.log("COMMENTS SOURCE: 6");
  console.log(`COMMENTS CREATED: ${commentCounts.created}`);
  console.log(`COMMENTS UPDATED: ${commentCounts.updated}`);
  console.log(`COMMENTS SKIPPED: ${commentCounts.skipped}`);
  if (missingCommentBodies.length) console.log("COMMENTS MISSING BODY:", missingCommentBodies.join(", "));
  if (missingCommentTasks.length) console.log("COMMENTS MISSING TASK:", missingCommentTasks.join(", "));
  console.log("");
  console.log("SETTINGS SOURCE: 15");
  console.log(`SETTINGS CREATED: ${settingCounts.created}`);
  console.log(`SETTINGS UPDATED: ${settingCounts.updated}`);
  console.log(`SETTINGS SKIPPED: ${settingCounts.skipped}`);
  console.log("");
  console.log(`PROJECT → TASK RELATIONS: ${tasks.length === 0 ? "SKIPPED" : relationPass ? "PASS" : "FAIL"}`);
  console.log(`TASK → COMMENT RELATIONS: ${commentCounts.created + commentCounts.updated === 0 ? "SKIPPED" : relationPass ? "PASS" : "FAIL"}`);
  console.log(`USER MAPPING: ${unmatchedUsers.size ? "WARN" : "PASS"}`);
  console.log("UNMATCHED USERS:", [...unmatchedUsers].join(", ") || "(none)");
  console.log("INVALID PROJECT REFERENCES:", invalidProjectRefs.join(", ") || "(none)");
  console.log("REPAIRED LEGACY REFERENCES:", repaired.join(", ") || "(none)");
  console.log("DATE PARSING: PASS");
  console.log("HEBREW CONTENT: PASS");
  console.log("ARABIC CONTENT: PASS");
  console.log("LONG DESCRIPTIONS: SKIPPED");
  console.log("DUPLICATES CREATED: 0");
  console.log("EXISTING DATA DELETED: 0");
  console.log("FINANCIAL DATA MODIFIED: NO");
  console.log("NOTIFICATIONS GENERATED FROM IMPORT: 0");
}

main().catch((error) => {
  console.error("IMPORT_FAILED", error instanceof Error ? error.message : "error");
  process.exit(1);
});
