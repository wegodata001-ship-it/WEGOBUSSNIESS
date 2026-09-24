import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { writeActivity } from "@/lib/admin/activity";
import { deleteMeetingDoc, upsertMeeting } from "@/lib/admin/meeting-write";
import { upsertTask } from "@/lib/admin/task-write";
import { notifyEmployees } from "@/lib/admin/notify";
import { normalizeTaskTeam } from "@/lib/admin/task-team";
import { actorCan, requireActor } from "@/lib/auth/server-actor";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import {
  businessDocPath,
  departmentDocPath,
  departmentsPath,
  employeeDocPath,
  employeesPath,
  logisticsRequestDocPath,
  logisticsRequestsPath,
  meetingsPath,
  memberDocPath,
  documentsPath,
  projectDocPath,
  projectsPath,
  businessSettingsDocPath,
  taskDocPath,
  tasksPath,
  userDocPath,
} from "@/lib/firebase/paths";
import { DEFAULT_BUSINESS_VAT_RATE, normalizeVatRate } from "@/lib/finance/vat";
import { normalizeProjectProgress } from "@/lib/admin/project-progress";
import { EMPLOYEE_PERMISSIONS } from "@/lib/permissions/defaults";
import { isDateOnly } from "@/lib/dates/format";
import type { Permission } from "@/types/permissions";

type Body = {
  businessId?: string;
  action?: string;
  id?: string;
  data?: Record<string, unknown>;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nullable(value: unknown) {
  const next = text(value);
  return next || null;
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function dateOrNull(value: unknown) {
  const next = nullable(value);
  if (!next) return null;
  return isDateOnly(next) ? next : null;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u0590-\u05ff\u0600-\u06ff-]/g, "")
    .slice(0, 48) || `item-${Date.now()}`;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  const businessId = text(body?.businessId);
  const action = text(body?.action);
  const id = text(body?.id);
  const data = body?.data ?? {};
  if (!businessId || !action) {
    return NextResponse.json({ error: "MISSING_PARAMS" }, { status: 400 });
  }

  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  const actor = resolved.actor!;
  const db = getAdminDb();
  const now = new Date();

  const need = (permission: Permission) => {
    if (!actorCan(actor, permission) && !actor.isSuperAdmin) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    return null;
  };

  try {
    if (action === "createTask" || action === "updateTask") {
      const result = await upsertTask({
        actor,
        businessId,
        taskId: action === "updateTask" ? id : undefined,
        data,
      });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json({ ok: true, id: result.id });
    }

    if (action === "changeTaskStatus" || action === "assignTask" || action === "archiveTask" || action === "deleteTask") {
      if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
      const permission: Permission = action === "deleteTask" ? "tasks.delete" : "tasks.edit";
      const denied = need(permission);
      if (denied) return denied;
      const ref = db.doc(taskDocPath(businessId, id));
      if (action === "deleteTask") {
        await ref.delete();
        await writeActivity({ businessId, actorUserId: actor.uid, action, entityType: "task", entityId: id, message: "משימה נמחקה" });
        return NextResponse.json({ ok: true, id });
      }
      const patch: Record<string, unknown> = { updatedAt: now };
      if (action === "archiveTask") patch.status = "ARCHIVED";
      if (action === "changeTaskStatus") patch.status = text(data.status) || "TODO";
      if (action === "assignTask") {
        const existingSnap = await ref.get();
        const existingData = existingSnap.data() ?? {};
        const existingTeam = normalizeTaskTeam(existingData);
        const team = normalizeTaskTeam({
          assigneeId: data.assigneeId,
          collaboratorIds: data.collaboratorIds,
          assigneeEmployeeId: data.assigneeEmployeeId,
          assigneeEmployeeIds: data.assigneeEmployeeIds,
        });
        patch.assigneeId = team.assigneeId;
        patch.collaboratorIds = team.collaboratorIds;
        patch.assigneeEmployeeId = team.assigneeId;
        patch.assigneeEmployeeIds = team.assigneeId ? [team.assigneeId, ...team.collaboratorIds] : team.collaboratorIds;
        const previousIds = new Set([existingTeam.assigneeId, ...existingTeam.collaboratorIds].filter((id): id is string => Boolean(id)));
        const notifyIds = [team.assigneeId, ...team.collaboratorIds]
          .filter((id): id is string => Boolean(id))
          .filter((employeeId) => !previousIds.has(employeeId));
        if (notifyIds.length) {
          const title = text(existingData.title) || "משימה";
          await notifyEmployees({
            businessId,
            employeeIds: notifyIds,
            title: `שויכת למשימה חדשה: ${title}`,
            body: `שויכת למשימה חדשה: ${title}`,
            href: "/tasks",
          });
        }
      }
      await ref.set(patch, { merge: true });
      await writeActivity({ businessId, actorUserId: actor.uid, action, entityType: "task", entityId: id, message: "עודכן סטטוס/אחראי משימה" });
      return NextResponse.json({ ok: true, id });
    }

    if (action === "createProject" || action === "updateProject") {
      const denied = need("projects.manage");
      if (denied) return denied;
      const name = text(data.name);
      if (!name) return NextResponse.json({ error: "NAME_REQUIRED" }, { status: 400 });
      if (action === "createProject" && !text(data.category)) {
        return NextResponse.json({ error: "CATEGORY_REQUIRED" }, { status: 400 });
      }
      const existingProjects = await db.collection(projectsPath(businessId)).get();
      const duplicate = existingProjects.docs.find((docSnap) =>
        String(docSnap.data().name ?? "").trim().toLowerCase() === name.toLowerCase() && docSnap.id !== id,
      );
      if (duplicate) return NextResponse.json({ error: "DUPLICATE_PROJECT" }, { status: 409 });
      const payload = {
        businessId,
        name,
        clientName: text(data.clientName),
        description: text(data.description),
        status: text(data.status) || "ACTIVE",
        departmentId: nullable(data.departmentId),
        managerEmployeeId: nullable(data.managerEmployeeId),
        startDate: dateOrNull(data.startDate),
        dueDate: dateOrNull(data.dueDate),
        ...(data.category !== undefined ? { category: nullable(data.category) } : {}),
        ...(data.location !== undefined ? { location: nullable(data.location) } : {}),
        ...(data.projectNumber !== undefined ? { projectNumber: nullable(data.projectNumber) } : {}),
        ...(data.progress !== undefined ? { progress: normalizeProjectProgress(data.progress) } : {}),
        isActive: data.isActive === false ? false : true,
        color: text(data.color) || "BLUE",
        updatedAt: now,
      };
      const ref = action === "createProject"
        ? db.collection(projectsPath(businessId)).doc()
        : db.doc(projectDocPath(businessId, id));
      if (action === "updateProject" && !id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
      await ref.set(action === "createProject"
        ? { ...payload, seedKey: null, createdBy: actor.uid, createdByUserId: actor.uid, createdAt: now, progress: normalizeProjectProgress(data.progress) }
        : payload, { merge: true });
      await writeActivity({
        businessId,
        actorUserId: actor.uid,
        action,
        entityType: "project",
        entityId: ref.id,
        message: `${action === "createProject" ? "נוצר" : "עודכן"} פרויקט: ${payload.name}`,
      });
      return NextResponse.json({ ok: true, id: ref.id });
    }

    if (action === "archiveProject" || action === "restoreProject") {
      const denied = need("projects.manage");
      if (denied) return denied;
      if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
      await db.doc(projectDocPath(businessId, id)).set({
        isActive: action === "restoreProject",
        status: text(data.status) || (action === "archiveProject" ? "ON_HOLD" : "ACTIVE"),
        updatedAt: now,
      }, { merge: true });
      await writeActivity({
        businessId,
        actorUserId: actor.uid,
        action,
        entityType: "project",
        entityId: id,
        message: action === "archiveProject" ? "פרויקט הועבר לארכיון" : "פרויקט שוחזר מארכיון",
      });
      return NextResponse.json({ ok: true, id });
    }

    if (action === "deleteProject") {
      const denied = need("projects.manage");
      if (denied) return denied;
      if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
      const [taskRefs, meetingRefs, documentRefs] = await Promise.all([
        db.collection(tasksPath(businessId)).where("projectId", "==", id).limit(1).get(),
        db.collection(meetingsPath(businessId)).where("projectId", "==", id).limit(1).get(),
        db.collection(documentsPath(businessId)).where("projectId", "==", id).limit(1).get(),
      ]);
      if (!taskRefs.empty || !meetingRefs.empty || !documentRefs.empty) {
        return NextResponse.json({ error: "PROJECT_IN_USE" }, { status: 409 });
      }
      await db.doc(projectDocPath(businessId, id)).delete();
      await writeActivity({ businessId, actorUserId: actor.uid, action, entityType: "project", entityId: id, message: "פרויקט נמחק" });
      return NextResponse.json({ ok: true, id });
    }

    if (action === "createMeeting" || action === "updateMeeting") {
      const result = await upsertMeeting({
        actor,
        businessId,
        meetingId: action === "updateMeeting" ? id : undefined,
        data,
      });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json({ ok: true, id: result.id });
    }

    if (action === "deleteMeeting") {
      const result = await deleteMeetingDoc({ actor, businessId, meetingId: id });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json({ ok: true, id: result.id });
    }

    if (action === "createRequest") {
      const denied = need("logistics.create");
      if (denied) return denied;
      const payload = {
        businessId,
        title: text(data.title),
        details: text(data.details),
        type: text(data.type) || "OTHER",
        status: "PENDING",
        amount: numberOrNull(data.amount),
        fileUrl: nullable(data.fileUrl),
        requestedByEmployeeId: actor.employeeId ?? "",
        requestedByUserId: actor.uid,
        reviewedByUserId: null,
        managerResponse: "",
        handledBy: null,
        handledAt: null,
        requestDate: dateOrNull(data.requestDate),
        createdAt: now,
        updatedAt: now,
      };
      if (!payload.title) return NextResponse.json({ error: "TITLE_REQUIRED" }, { status: 400 });
      const ref = db.collection(logisticsRequestsPath(businessId)).doc();
      await ref.set(payload);
      await writeActivity({ businessId, actorUserId: actor.uid, action, entityType: "request", entityId: ref.id, message: `נפתחה בקשה: ${payload.title}` });
      return NextResponse.json({ ok: true, id: ref.id });
    }

    if (action === "handleRequest") {
      const denied = need("logistics.approve");
      if (denied) return denied;
      if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
      await db.doc(logisticsRequestDocPath(businessId, id)).set({
        status: text(data.status) || "PENDING",
        managerResponse: text(data.managerResponse),
        reviewedByUserId: actor.uid,
        handledBy: actor.uid,
        handledAt: now,
        updatedAt: now,
      }, { merge: true });
      await writeActivity({ businessId, actorUserId: actor.uid, action, entityType: "request", entityId: id, message: "עודכן טיפול בבקשה" });
      return NextResponse.json({ ok: true, id });
    }

    if (action === "createDepartment" || action === "updateDepartment") {
      const denied = need("departments.manage");
      if (denied) return denied;
      const name = text(data.name);
      if (!name) return NextResponse.json({ error: "NAME_REQUIRED" }, { status: 400 });
      const snap = await db.collection(departmentsPath(businessId)).get();
      const duplicate = snap.docs.find((docSnap) =>
        String(docSnap.data().name ?? "").trim().toLowerCase() === name.toLowerCase() && docSnap.id !== id,
      );
      if (duplicate) return NextResponse.json({ error: "DUPLICATE_DEPARTMENT" }, { status: 409 });
      const ref = action === "createDepartment"
        ? db.collection(departmentsPath(businessId)).doc()
        : db.doc(departmentDocPath(businessId, id));
      if (action === "updateDepartment" && !id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
      await ref.set({
        businessId,
        name,
        description: text(data.description),
        color: text(data.color) || "BLUE",
        managerEmployeeId: nullable(data.managerEmployeeId),
        isActive: data.isActive === false ? false : true,
        updatedAt: now,
        ...(action === "createDepartment"
          ? { slug: slugify(name), createdBy: actor.uid, createdByUserId: actor.uid, createdAt: now }
          : {}),
      }, { merge: true });
      await writeActivity({ businessId, actorUserId: actor.uid, action, entityType: "department", entityId: ref.id, message: `מחלקה: ${name}` });
      return NextResponse.json({ ok: true, id: ref.id });
    }

    if (action === "deleteDepartment") {
      const denied = need("departments.manage");
      if (denied) return denied;
      if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
      const [taskRefs, employeeRefs, projectRefs] = await Promise.all([
        db.collection(tasksPath(businessId)).where("departmentId", "==", id).limit(1).get(),
        db.collection(employeesPath(businessId)).where("departmentId", "==", id).limit(1).get(),
        db.collection(projectsPath(businessId)).where("departmentId", "==", id).limit(1).get(),
      ]);
      if (!taskRefs.empty || !employeeRefs.empty || !projectRefs.empty) {
        return NextResponse.json({ error: "DEPARTMENT_IN_USE" }, { status: 409 });
      }
      await db.doc(departmentDocPath(businessId, id)).delete();
      await writeActivity({ businessId, actorUserId: actor.uid, action, entityType: "department", entityId: id, message: "מחלקה נמחקה" });
      return NextResponse.json({ ok: true, id });
    }

    if (action === "createEmployee" || action === "updateEmployee") {
      const denied = need("employees.manage");
      if (denied) return denied;
      const email = text(data.email).toLowerCase();
      const displayName = text(data.displayName) || `${text(data.firstName)} ${text(data.lastName)}`.trim();
      if (!displayName) return NextResponse.json({ error: "NAME_REQUIRED" }, { status: 400 });

      if (action === "createEmployee") {
        if (!email) return NextResponse.json({ error: "EMAIL_REQUIRED" }, { status: 400 });
        const existingEmp = await db.collection(employeesPath(businessId)).where("email", "==", email).limit(1).get();
        if (!existingEmp.empty) return NextResponse.json({ error: "DUPLICATE_EMPLOYEE" }, { status: 409 });
        const auth = getAdminAuth();
        const authUser = await auth.getUserByEmail(email).catch(() => null);
        const uid = authUser?.uid ?? (await auth.createUser({
          email,
          displayName,
          password: randomBytes(24).toString("base64url"),
          disabled: false,
        })).uid;
        await db.doc(userDocPath(uid)).set({
          email,
          displayName,
          phone: nullable(data.phone),
          photoUrl: null,
          platformRole: null,
          defaultBusinessId: businessId,
          locale: "he",
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }, { merge: true });
        const empRef = db.collection(employeesPath(businessId)).doc();
        await empRef.set({
          businessId,
          userId: uid,
          firstName: text(data.firstName) || displayName,
          lastName: text(data.lastName),
          displayName,
          email,
          phone: nullable(data.phone),
          departmentId: nullable(data.departmentId),
          jobTitle: nullable(data.jobTitle),
          status: text(data.status) || "ACTIVE",
          startDate: dateOrNull(data.startDate),
          createdAt: now,
          updatedAt: now,
        });
        await db.doc(memberDocPath(businessId, uid)).set({
          userId: uid,
          businessId,
          employeeId: empRef.id,
          role: text(data.role) || "EMPLOYEE",
          permissions: EMPLOYEE_PERMISSIONS,
          email,
          displayName,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }, { merge: true });
        await db.doc(userDocPath(uid)).collection("memberships").doc(businessId).set({
          businessId,
          role: text(data.role) || "EMPLOYEE",
          isActive: true,
        }, { merge: true });
        await writeActivity({ businessId, actorUserId: actor.uid, action, entityType: "employee", entityId: empRef.id, message: `נוסף עובד: ${displayName}` });
        return NextResponse.json({ ok: true, id: empRef.id });
      }

      if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
      const empRef = db.doc(employeeDocPath(businessId, id));
      const empSnap = await empRef.get();
      if (!empSnap.exists) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
      await empRef.set({
        firstName: text(data.firstName) || displayName,
        lastName: text(data.lastName),
        displayName,
        phone: nullable(data.phone),
        departmentId: nullable(data.departmentId),
        jobTitle: nullable(data.jobTitle),
        status: text(data.status) || "ACTIVE",
        updatedAt: now,
      }, { merge: true });
      const userId = String(empSnap.data()?.userId ?? "");
      if (userId) {
        await db.doc(userDocPath(userId)).set({ displayName, phone: nullable(data.phone), isActive: text(data.status) !== "INACTIVE", updatedAt: now }, { merge: true });
        if (text(data.role)) {
          await db.doc(memberDocPath(businessId, userId)).set({
            role: text(data.role),
            displayName,
            isActive: text(data.status) !== "INACTIVE",
            updatedAt: now,
          }, { merge: true });
        }
      }
      await writeActivity({ businessId, actorUserId: actor.uid, action, entityType: "employee", entityId: id, message: `עודכן עובד: ${displayName}` });
      return NextResponse.json({ ok: true, id });
    }

    if (action === "updateBusiness") {
      const denied = need("settings.manage");
      if (denied) return denied;
      await db.doc(businessDocPath(businessId)).set({
        name: text(data.name) || undefined,
        primaryColor: text(data.primaryColor) || undefined,
        secondaryColor: text(data.secondaryColor) || undefined,
        language: text(data.language) || undefined,
        timezone: text(data.timezone) || undefined,
        updatedAt: now,
      }, { merge: true });
      if (data.vatRate !== undefined) {
        await db.doc(businessSettingsDocPath(businessId)).set({
          businessId,
          vatRate: normalizeVatRate(data.vatRate, DEFAULT_BUSINESS_VAT_RATE),
          updatedAt: now,
        }, { merge: true });
      }
      await writeActivity({ businessId, actorUserId: actor.uid, action, entityType: "business", entityId: businessId, message: "עודכנו הגדרות העסק" });
      return NextResponse.json({ ok: true, id: businessId });
    }

    if (action === "updateDocument") {
      const denied = need("documents.manage");
      if (denied) return denied;
      if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
      const { documentDocPath } = await import("@/lib/firebase/paths");
      await db.doc(documentDocPath(businessId, id)).set({
        name: text(data.name) || undefined,
        category: text(data.category) || undefined,
        projectId: nullable(data.projectId),
        clientName: text(data.clientName),
        note: text(data.note),
        updatedAt: now,
      }, { merge: true });
      return NextResponse.json({ ok: true, id });
    }

    return NextResponse.json({ error: "UNKNOWN_ACTION" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("MUTATE_FAILED", action, message);
    return NextResponse.json({ error: "MUTATE_FAILED" }, { status: 500 });
  }
}
