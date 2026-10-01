import { NextResponse } from "next/server";
import { writeActivity } from "@/lib/admin/activity";
import { departmentColorHex } from "@/lib/admin/department-categories";
import {
  createBusinessDocRecord,
  duplicateBusinessDocRecord,
  sendBusinessDocRecord,
  updateBusinessDocRecord,
  upsertClientRecord,
} from "@/lib/admin/business-doc-write";
import { createBusinessEmployee, resetBusinessEmployeePassword, updateBusinessEmployee } from "@/lib/admin/employee-write";
import { deleteMeetingDoc, upsertMeeting } from "@/lib/admin/meeting-write";
import { syncProjectProgressFromTasks } from "@/lib/admin/project-progress-sync";
import { taskCompletionPatch } from "@/lib/admin/task-completion";
import { upsertTask } from "@/lib/admin/task-write";
import { notifyEmployees, notifyManagers, notifyUsers } from "@/lib/admin/notify";
import { normalizeTaskTeam } from "@/lib/admin/task-team";
import { actorCan, requireActor } from "@/lib/auth/server-actor";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  businessDocPath,
  departmentCategoryDocPath,
  departmentCategoriesPath,
  departmentDocPath,
  departmentsPath,
  employeesPath,
  logisticsRequestDocPath,
  logisticsRequestsPath,
  meetingsPath,
  documentsPath,
  projectDocPath,
  projectsPath,
  businessDocumentDocPath,
  businessSettingsDocPath,
  termsTemplatesPath,
  taskDocPath,
  tasksPath,
} from "@/lib/firebase/paths";
import { isOtherBusinessType, normalizeBusinessServices } from "@/lib/data/business-profile";
import { DEFAULT_BUSINESS_VAT_RATE, normalizeVatRate } from "@/lib/finance/vat";
import { normalizeProjectProgress } from "@/lib/admin/project-progress";
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
        const existing = (await ref.get()).data() ?? {};
        await ref.delete();
        await syncProjectProgressFromTasks(businessId, typeof existing.projectId === "string" ? existing.projectId : null);
        await writeActivity({ businessId, actorUserId: actor.uid, action, entityType: "task", entityId: id, message: "משימה נמחקה" });
        return NextResponse.json({ ok: true, id });
      }
      const existingSnap = await ref.get();
      const existingData = existingSnap.data() ?? {};
      const patch: Record<string, unknown> = { updatedAt: now };
      if (action === "archiveTask") patch.status = "ARCHIVED";
      if (action === "changeTaskStatus") {
        Object.assign(patch, taskCompletionPatch({
          previousStatus: text(existingData.status),
          nextStatus: text(data.status) || "TODO",
          actorUserId: actor.uid,
          now,
        }));
      }
      if (action === "assignTask") {
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
            body: title,
            href: `/tasks?taskId=${encodeURIComponent(id)}`,
            type: "task.assigned",
            entityType: "task",
            entityId: id,
            subject: "WEGO BIZ — משימה חדשה הוקצתה לך",
            dedupeKey: `TASK_ASSIGNED:${id}:${notifyIds.join(",")}`,
          });
        }
      }
      await ref.set(patch, { merge: true });
      if (action === "changeTaskStatus" || action === "archiveTask") {
        await syncProjectProgressFromTasks(businessId, typeof existingData.projectId === "string" ? existingData.projectId : null);
      }
      await writeActivity({ businessId, actorUserId: actor.uid, action, entityType: "task", entityId: id, message: "עודכן סטטוס/אחראי משימה" });
      return NextResponse.json({ ok: true, id });
    }

    if (action === "createProject" || action === "updateProject") {
      const denied = need("projects.manage");
      if (denied) return denied;
      const name = text(data.name);
      if (!name) return NextResponse.json({ error: "NAME_REQUIRED" }, { status: 400 });
      const departmentId = nullable(data.departmentId);
      const categoryId = text(data.categoryId);
      if (action === "createProject" && !categoryId) {
        return NextResponse.json({ error: "CATEGORY_REQUIRED" }, { status: 400 });
      }
      let categoryName = nullable(data.categoryName) ?? nullable(data.category);
      if (categoryId) {
        const categorySnap = await db.doc(departmentCategoryDocPath(businessId, categoryId)).get();
        if (!categorySnap.exists) return NextResponse.json({ error: "INVALID_CATEGORY" }, { status: 400 });
        if (action === "createProject" && categorySnap.data()?.isActive === false) {
          return NextResponse.json({ error: "INVALID_CATEGORY" }, { status: 400 });
        }
        categoryName = text(categorySnap.data()?.name) || categoryName;
      }
      const existingProjectSnap = action === "updateProject" && id ? await db.doc(projectDocPath(businessId, id)).get() : null;
      const previousManager = typeof existingProjectSnap?.data()?.managerEmployeeId === "string" ? existingProjectSnap.data()!.managerEmployeeId as string : "";
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
        departmentId,
        managerEmployeeId: nullable(data.managerEmployeeId),
        startDate: dateOrNull(data.startDate),
        dueDate: dateOrNull(data.dueDate),
        ...(data.categoryId !== undefined || categoryId
          ? { categoryId: categoryId || null, categoryName: categoryName, category: categoryName }
          : data.category !== undefined ? { category: nullable(data.category) }
            : {}),
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
      const nextManager = payload.managerEmployeeId || "";
      if (nextManager && nextManager !== previousManager) {
        await notifyEmployees({
          businessId,
          employeeIds: [nextManager],
          skipUserIds: [actor.uid],
          title: `התווספת לפרויקט ${payload.name}`,
          body: payload.name,
          href: `/projects/${ref.id}`,
          type: "project.added",
          entityType: "project",
          entityId: ref.id,
          channels: { inApp: true, email: false },
          dedupeKey: `PROJECT_ADDED:${ref.id}:${nextManager}`,
        });
      }
      if (previousManager && previousManager !== nextManager) {
        await notifyEmployees({
          businessId,
          employeeIds: [previousManager],
          skipUserIds: [actor.uid],
          title: `הוסרת מהפרויקט ${payload.name}`,
          body: payload.name,
          href: "/projects",
          type: "project.removed",
          entityType: "project",
          entityId: ref.id,
          channels: { inApp: true, email: false },
          dedupeKey: `PROJECT_REMOVED:${ref.id}:${previousManager}`,
        });
      }
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
      await notifyManagers({
        businessId,
        skipUserIds: [actor.uid],
        title: "בקשה חדשה ממתינה לטיפול",
        body: payload.title,
        href: "/requests",
        type: "request.created",
        entityType: "request",
        entityId: ref.id,
      });
      await writeActivity({ businessId, actorUserId: actor.uid, action, entityType: "request", entityId: ref.id, message: `נפתחה בקשה: ${payload.title}` });
      return NextResponse.json({ ok: true, id: ref.id });
    }

    if (action === "handleRequest") {
      const denied = need("logistics.approve");
      if (denied) return denied;
      if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
      const requestSnap = await db.doc(logisticsRequestDocPath(businessId, id)).get();
      const requestData = requestSnap.data() ?? {};
      const nextStatus = text(data.status) || "PENDING";
      await db.doc(logisticsRequestDocPath(businessId, id)).set({
        status: nextStatus,
        managerResponse: text(data.managerResponse),
        reviewedByUserId: actor.uid,
        handledBy: actor.uid,
        handledAt: now,
        updatedAt: now,
      }, { merge: true });
      const requester = typeof requestData.requestedByUserId === "string" ? requestData.requestedByUserId : "";
      const approved = nextStatus === "APPROVED" || nextStatus === "DONE";
      if (requester) {
        await notifyUsers({
          businessId,
          userIds: [requester],
          skipUserIds: [actor.uid],
          title: approved ? "הבקשה אושרה" : nextStatus === "REJECTED" ? "הבקשה נדחתה" : "הבקשה עודכנה",
          body: text(requestData.title) || text(data.managerResponse),
          href: "/requests",
          type: "request.updated",
          entityType: "request",
          entityId: id,
          channels: { inApp: true, email: true },
          dedupeKey: `REQUEST_UPDATED:${id}:${nextStatus}`,
        });
      }
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
      const categorySnap = await db.collection(departmentCategoriesPath(businessId)).where("departmentId", "==", id).get();
      await Promise.all(categorySnap.docs.map((docSnap) => docSnap.ref.delete()));
      await db.doc(departmentDocPath(businessId, id)).delete();
      await writeActivity({ businessId, actorUserId: actor.uid, action, entityType: "department", entityId: id, message: "מחלקה נמחקה" });
      return NextResponse.json({ ok: true, id });
    }

    if (action === "createDepartmentCategory" || action === "updateDepartmentCategory") {
      const denied = need("departments.manage");
      if (denied) return denied;
      const name = text(data.name);
      const departmentId = text(data.departmentId);
      if (!name) return NextResponse.json({ error: "NAME_REQUIRED" }, { status: 400 });
      if (!departmentId) return NextResponse.json({ error: "DEPARTMENT_REQUIRED" }, { status: 400 });
      const departmentSnap = await db.doc(departmentDocPath(businessId, departmentId)).get();
      if (!departmentSnap.exists) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
      const existing = await db.collection(departmentCategoriesPath(businessId)).where("departmentId", "==", departmentId).get();
      const duplicate = existing.docs.find((docSnap) =>
        String(docSnap.data().name ?? "").trim().toLowerCase() === name.toLowerCase() && docSnap.id !== id,
      );
      if (duplicate) return NextResponse.json({ error: "DUPLICATE_CATEGORY" }, { status: 409 });
      const ref = action === "createDepartmentCategory"
        ? db.collection(departmentCategoriesPath(businessId)).doc()
        : db.doc(departmentCategoryDocPath(businessId, id));
      if (action === "updateDepartmentCategory" && !id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
      await ref.set({
        businessId,
        departmentId,
        name,
        isActive: data.isActive === false ? false : true,
        color: text(data.color) || departmentColorHex(String(departmentSnap.data()?.color ?? "BLUE")),
        updatedAt: now,
        ...(action === "createDepartmentCategory" ? { createdAt: now } : {}),
      }, { merge: true });
      await writeActivity({ businessId, actorUserId: actor.uid, action, entityType: "departmentCategory", entityId: ref.id, message: `קטגוריה: ${name}` });
      return NextResponse.json({ ok: true, id: ref.id });
    }

    if (action === "deleteDepartmentCategory") {
      const denied = need("departments.manage");
      if (denied) return denied;
      if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
      const used = await db.collection(projectsPath(businessId)).where("categoryId", "==", id).get();
      const moveTo = text(data.moveToCategoryId);
      if (!used.empty && !moveTo) {
        return NextResponse.json({ error: "CATEGORY_IN_USE", count: used.size }, { status: 409 });
      }
      if (!used.empty && moveTo) {
        if (moveTo === id) return NextResponse.json({ error: "INVALID_CATEGORY" }, { status: 400 });
        const target = await db.doc(departmentCategoryDocPath(businessId, moveTo)).get();
        if (!target.exists) return NextResponse.json({ error: "INVALID_CATEGORY" }, { status: 400 });
        const nextName = text(target.data()?.name);
        await Promise.all(used.docs.map((docSnap) => docSnap.ref.set({
          categoryId: moveTo,
          categoryName: nextName,
          category: nextName,
          updatedAt: now,
        }, { merge: true })));
      }
      await db.doc(departmentCategoryDocPath(businessId, id)).delete();
      await writeActivity({ businessId, actorUserId: actor.uid, action, entityType: "departmentCategory", entityId: id, message: "קטגוריה נמחקה" });
      return NextResponse.json({ ok: true, id });
    }

    if (action === "createEmployee" || action === "updateEmployee") {
      const denied = need("employees.manage");
      if (denied) return denied;
      const result = action === "createEmployee"
        ? await createBusinessEmployee({ actor, businessId, data })
        : await updateBusinessEmployee({ actor, businessId, id, data });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      await writeActivity({
        businessId,
        actorUserId: actor.uid,
        action,
        entityType: "employee",
        entityId: result.id,
        message: action === "createEmployee" ? `נוסף עובד: ${text(data.displayName)}` : `עודכן עובד: ${text(data.displayName)}`,
      });
      return NextResponse.json({ ok: true, id: result.id });
    }

    if (action === "resetEmployeePassword") {
      const denied = need("employees.manage");
      if (denied) return denied;
      const result = await resetBusinessEmployeePassword({ actor, businessId, id, password: data.password });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      await writeActivity({
        businessId,
        actorUserId: actor.uid,
        action,
        entityType: "employee",
        entityId: result.id,
        message: "עודכנה סיסמת עובד",
      });
      return NextResponse.json({ ok: true, id: result.id });
    }

    if (action === "updateBusiness") {
      const denied = need("settings.manage");
      if (denied) return denied;
      if (data.name !== undefined && !text(data.name)) {
        return NextResponse.json({ error: "NAME_REQUIRED" }, { status: 400 });
      }
      const businessPatch: Record<string, unknown> = { updatedAt: now };
      if (text(data.name)) businessPatch.name = text(data.name);
      if (data.nameAr !== undefined) businessPatch.nameAr = text(data.nameAr);
      if (text(data.primaryColor)) businessPatch.primaryColor = text(data.primaryColor);
      if (text(data.secondaryColor)) businessPatch.secondaryColor = text(data.secondaryColor);
      if (text(data.language)) businessPatch.language = text(data.language);
      if (text(data.timezone)) businessPatch.timezone = text(data.timezone);
      if (data.logoUrl !== undefined) businessPatch.logoUrl = nullable(data.logoUrl);
      await db.doc(businessDocPath(businessId)).set(businessPatch, { merge: true });
      const settingsPatch: Record<string, unknown> = { businessId, updatedAt: now };
      if (data.vatRate !== undefined) settingsPatch.vatRate = normalizeVatRate(data.vatRate, DEFAULT_BUSINESS_VAT_RATE);
      const nextLegalType = data.legalType !== undefined ? text(data.legalType) : "";
      if (data.legalType !== undefined) settingsPatch.legalType = nextLegalType;
      if (data.customBusinessType !== undefined) {
        settingsPatch.customBusinessType = isOtherBusinessType(nextLegalType)
          ? text(data.customBusinessType)
          : "";
      }
      if (data.taxId !== undefined) settingsPatch.taxId = text(data.taxId);
      if (data.phone !== undefined) settingsPatch.phone = text(data.phone);
      if (data.email !== undefined) settingsPatch.email = text(data.email);
      if (data.address !== undefined) settingsPatch.address = text(data.address);
      if (data.website !== undefined) settingsPatch.website = text(data.website);
      if (data.about !== undefined) settingsPatch.about = text(data.about);
      if (data.aboutAr !== undefined) settingsPatch.aboutAr = text(data.aboutAr);
      if (data.nameAr !== undefined) settingsPatch.nameAr = text(data.nameAr);
      if (Array.isArray(data.services)) settingsPatch.services = normalizeBusinessServices(data.services);
      if (data.logoUrl !== undefined) {
        settingsPatch.logoUrl = nullable(data.logoUrl);
        if (!settingsPatch.logoUrl) settingsPatch.logoStoragePath = null;
      }
      await db.doc(businessSettingsDocPath(businessId)).set(settingsPatch, { merge: true });
      await writeActivity({ businessId, actorUserId: actor.uid, action, entityType: "business", entityId: businessId, message: "עודכנו הגדרות העסק" });
      return NextResponse.json({ ok: true, id: businessId });
    }

    if (action === "createClient" || action === "updateClient") {
      const denied = need("documents.manage");
      if (denied) return denied;
      const result = await upsertClientRecord({
        businessId,
        id: action === "updateClient" ? id : undefined,
        data,
      });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json({ ok: true, id: result.id, client: result.client });
    }

    if (action === "createBusinessDoc" || action === "updateBusinessDoc" || action === "sendBusinessDoc" || action === "duplicateBusinessDoc" || action === "deleteBusinessDoc") {
      const denied = need("documents.manage");
      if (denied) return denied;
      if (action === "createBusinessDoc") {
        const result = await createBusinessDocRecord({ businessId, actorUid: actor.uid, data });
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
        await writeActivity({ businessId, actorUserId: actor.uid, action, entityType: "businessDoc", entityId: result.id, message: "נוצר מסמך עסקי" });
        return NextResponse.json({ ok: true, id: result.id });
      }
      if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
      if (action === "deleteBusinessDoc") {
        await db.doc(businessDocumentDocPath(businessId, id)).delete();
        return NextResponse.json({ ok: true, id });
      }
      if (action === "sendBusinessDoc") {
        const result = await sendBusinessDocRecord({ businessId, id });
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
        return NextResponse.json({ ok: true, id, token: result.token });
      }
      if (action === "duplicateBusinessDoc") {
        const result = await duplicateBusinessDocRecord({ businessId, id, actorUid: actor.uid });
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
        return NextResponse.json({ ok: true, id: result.id });
      }
      const result = await updateBusinessDocRecord({ businessId, id, data });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json({ ok: true, id: result.id, newVersion: "newVersion" in result ? result.newVersion : false });
    }

    if (action === "createTermsTemplate") {
      const denied = need("documents.manage");
      if (denied) return denied;
      const body = text(data.body);
      if (!body) return NextResponse.json({ error: "TERMS_REQUIRED" }, { status: 400 });
      const ref = db.collection(termsTemplatesPath(businessId)).doc();
      await ref.set({
        businessId,
        name: text(data.name) || "תבנית תנאים",
        body,
        createdAt: now,
      });
      return NextResponse.json({ ok: true, id: ref.id });
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
