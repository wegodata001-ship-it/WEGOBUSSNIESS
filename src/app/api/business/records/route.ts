import { NextResponse } from "next/server";
import { canRestoreTasks } from "@/lib/admin/task-delete";
import { isTaskSoftDeleted } from "@/lib/admin/task-delete-rules";
import { canSeeTaskDoc } from "@/lib/admin/task-access";
import { canViewTaskFinance } from "@/lib/finance/access";
import { hideTaskFinance } from "@/lib/finance/public-task";
import { toTimestamp } from "@/lib/dates/timestamp";
import { actorCan, requireActor } from "@/lib/auth/server-actor";
import { filterMeetingsForActor } from "@/lib/permissions/meeting-access";
import { canListBusinessProjects, canViewAllBusinessProjects, filterProjectsForActor } from "@/lib/permissions/project-access";
import {
  toActivityLog,
  toAppUser,
  toBusiness,
  toDepartment,
  toDepartmentCategory,
  toEmployee,
  toLogisticsRequest,
  toBusinessDocument,
  toMeeting,
  toMembership,
  toNotification,
  toProject,
  toBusinessSettings,
  toBusinessClient,
  toBusinessDocumentRecord,
  toCatalogSetting,
  toPaymentRecord,
  toServiceItem,
  toTermsTemplate,
  toTask,
  toTaskTemplate,
  toMoneyMovement,
  toWorkSession,
} from "@/lib/firebase/converters";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  activityLogsPath,
  businessDocsPath,
  businessMembersPath,
  clientsPath,
  collections,
  departmentCategoriesPath,
  departmentsPath,
  documentsPath,
  employeesPath,
  logisticsRequestsPath,
  businessSettingsDocPath,
  businessSettingsPath,
  meetingsPath,
  notificationsPath,
  paymentsPath,
  projectsPath,
  serviceItemsPath,
  tasksPath,
  taskTemplatesPath,
  movementsPath,
  termsTemplatesPath,
  workSessionsPath,
} from "@/lib/firebase/paths";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const businessId = url.searchParams.get("businessId") ?? "";
  const kind = url.searchParams.get("kind") ?? "";
  if (!businessId || !kind) {
    return NextResponse.json({ error: "MISSING_PARAMS" }, { status: 400 });
  }

  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  const actor = resolved.actor!;
  const db = getAdminDb();

  if (kind === "tasks") {
    const includeDeleted = url.searchParams.get("includeDeleted") === "1" && canRestoreTasks(actor);
    const deletedOnly = url.searchParams.get("deletedOnly") === "1" && canRestoreTasks(actor);
    const snap = await db.collection(tasksPath(businessId)).get();
    const tasks = snap.docs.map((docSnap) => toTask(docSnap.id, docSnap.data()));
    const visible = tasks.filter((task) => {
      if (!canSeeTaskDoc(actor, task)) return false;
      const softDeleted = isTaskSoftDeleted(task);
      if (deletedOnly) return softDeleted;
      if (softDeleted && !includeDeleted) return false;
      return true;
    });
    const canSeeMoney = canViewTaskFinance(actor);
    return NextResponse.json({
      data: canSeeMoney ? visible : visible.map(hideTaskFinance),
    });
  }

  if (kind === "catalog") {
    const snap = await db.collection(businessSettingsPath(businessId)).get();
    return NextResponse.json({
      data: snap.docs
        .map((docSnap) => toCatalogSetting(docSnap.id, docSnap.data()))
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    });
  }

  if (kind === "settings") {
    const snap = await db.doc(businessSettingsDocPath(businessId)).get();
    return NextResponse.json({
      data: toBusinessSettings(snap.exists ? snap.id : "general", snap.data() ?? { businessId }),
    });
  }

  if (kind === "payments") {
    if (!canViewTaskFinance(actor)) return NextResponse.json({ data: [] });
    const snap = await db.collection(paymentsPath(businessId)).get();
    return NextResponse.json({
      data: snap.docs.map((docSnap) => toPaymentRecord(docSnap.id, docSnap.data())),
    });
  }

  if (kind === "employees") {
    if (!actorCan(actor, "employees.view") && !actorCan(actor, "tasks.view") && !actor.isSuperAdmin) {
      return NextResponse.json({ data: [] });
    }
    const snap = await db.collection(employeesPath(businessId)).get();
    return NextResponse.json({
      data: snap.docs.map((docSnap) => toEmployee(docSnap.id, docSnap.data())),
    });
  }

  if (kind === "departments") {
    if (!actorCan(actor, "departments.view") && !actor.isSuperAdmin) {
      return NextResponse.json({ data: [] });
    }
    const snap = await db.collection(departmentsPath(businessId)).get();
    return NextResponse.json({
      data: snap.docs.map((docSnap) => toDepartment(docSnap.id, docSnap.data())),
    });
  }

  if (kind === "departmentCategories") {
    const canReadCategories = actor.isSuperAdmin
      || actor.isOwnerOrManager
      || actorCan(actor, "departments.view")
      || actorCan(actor, "projects.view")
      || actorCan(actor, "projects.manage")
      || actorCan(actor, "tasks.create")
      || actorCan(actor, "tasks.edit");
    if (!canReadCategories) {
      return NextResponse.json({ data: [] });
    }
    const snap = await db.collection(departmentCategoriesPath(businessId)).get();
    return NextResponse.json({
      data: snap.docs.map((docSnap) => toDepartmentCategory(docSnap.id, docSnap.data())),
    });
  }

  if (kind === "members") {
    if (!actorCan(actor, "users.view") && !actor.isSuperAdmin) {
      return NextResponse.json({ data: [] });
    }
    const snap = await db.collection(businessMembersPath(businessId)).get();
    return NextResponse.json({
      data: snap.docs.map((docSnap) => toMembership(docSnap.data(), businessId)),
    });
  }

  if (kind === "sessions") {
    const snap = await db.collection(workSessionsPath(businessId)).get();
    const sessions = snap.docs.map((docSnap) => toWorkSession(docSnap.id, docSnap.data()));
    const viewAll = actorCan(actor, "workHours.viewAll") || actor.isSuperAdmin;
    return NextResponse.json({
      data: viewAll ? sessions : sessions.filter((session) => session.employeeId === actor.employeeId),
    });
  }

  if (kind === "meetings") {
    if (!actorCan(actor, "meetings.view") && !actor.isSuperAdmin) {
      return NextResponse.json({ data: [] });
    }
    try {
      const snap = await db.collection(meetingsPath(businessId)).get();
      const meetings = [];
      for (const docSnap of snap.docs) {
        try {
          meetings.push(toMeeting(docSnap.id, docSnap.data()));
        } catch (error) {
          console.error(
            "[RECORDS_MEETINGS]",
            "convert_failed",
            docSnap.id,
            error instanceof Error ? error.name : "Error",
          );
        }
      }
      return NextResponse.json({
        data: filterMeetingsForActor(actor, meetings),
      });
    } catch (error) {
      console.error(
        "[RECORDS_MEETINGS]",
        "list_failed",
        error instanceof Error ? error.name : "Error",
      );
      return NextResponse.json({ data: [] });
    }
  }

  if (kind === "requests") {
    const snap = await db.collection(logisticsRequestsPath(businessId)).get();
    const requests = snap.docs.map((docSnap) => toLogisticsRequest(docSnap.id, docSnap.data()));
    if (actorCan(actor, "logistics.viewAll") || actor.isSuperAdmin) {
      return NextResponse.json({ data: requests });
    }
    return NextResponse.json({
      data: requests.filter((item) => item.requestedByUserId === actor.uid),
    });
  }

  if (kind === "projects") {
    if (!canListBusinessProjects(actor)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    const snap = await db.collection(projectsPath(businessId)).get();
    const projects = snap.docs.map((docSnap) => toProject(docSnap.id, docSnap.data()));
    if (canViewAllBusinessProjects(actor)) {
      return NextResponse.json({ data: projects });
    }
    const taskSnap = await db.collection(tasksPath(businessId)).get();
    const tasks = taskSnap.docs
      .map((docSnap) => toTask(docSnap.id, docSnap.data()))
      .filter((task) => !isTaskSoftDeleted(task));
    return NextResponse.json({
      data: filterProjectsForActor(actor, projects, tasks),
    });
  }

  if (kind === "clients") {
    if (!actorCan(actor, "documents.view") && !actorCan(actor, "projects.view") && !actor.isSuperAdmin) {
      return NextResponse.json({ data: [] });
    }
    const snap = await db.collection(clientsPath(businessId)).get();
    return NextResponse.json({
      data: snap.docs.map((docSnap) => toBusinessClient(docSnap.id, docSnap.data())),
    });
  }

  if (kind === "businessDocs") {
    if (!actorCan(actor, "documents.view") && !actor.isSuperAdmin) {
      return NextResponse.json({ data: [] });
    }
    const snap = await db.collection(businessDocsPath(businessId)).get();
    return NextResponse.json({
      data: snap.docs.map((docSnap) => toBusinessDocumentRecord(docSnap.id, docSnap.data())),
    });
  }

  if (kind === "termsTemplates") {
    if (!actorCan(actor, "documents.view") && !actor.isSuperAdmin) {
      return NextResponse.json({ data: [] });
    }
    const snap = await db.collection(termsTemplatesPath(businessId)).get();
    return NextResponse.json({
      data: snap.docs.map((docSnap) => toTermsTemplate(docSnap.id, docSnap.data())),
    });
  }

  if (kind === "taskStatuses") {
    const { listTaskStatusesReadOnly } = await import("@/lib/admin/task-status-write");
    const data = await listTaskStatusesReadOnly(businessId);
    return NextResponse.json({ data });
  }

  if (kind === "movements") {
    if (!canViewTaskFinance(actor)) return NextResponse.json({ data: [] });
    const snap = await db.collection(movementsPath(businessId)).get();
    return NextResponse.json({
      data: snap.docs
        .map((docSnap) => toMoneyMovement(docSnap.id, docSnap.data()))
        .sort((left, right) => right.date.localeCompare(left.date) || (toTimestamp(right.createdAt) - toTimestamp(left.createdAt))),
    });
  }

  if (kind === "taskTemplates") {
    if (!canListBusinessProjects(actor)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    const snap = await db.collection(taskTemplatesPath(businessId)).get();
    return NextResponse.json({
      data: snap.docs.map((docSnap) => toTaskTemplate(docSnap.id, docSnap.data())),
    });
  }

  if (kind === "serviceItems") {
    if (!actorCan(actor, "documents.view") && !actor.isSuperAdmin) {
      return NextResponse.json({ data: [] });
    }
    const snap = await db.collection(serviceItemsPath(businessId)).get();
    return NextResponse.json({
      data: snap.docs.map((docSnap) => toServiceItem(docSnap.id, docSnap.data())),
    });
  }

  if (kind === "documents") {
    if (!actorCan(actor, "documents.view") && !actor.isSuperAdmin) {
      return NextResponse.json({ data: [] });
    }
    const snap = await db.collection(documentsPath(businessId)).get();
    return NextResponse.json({
      data: snap.docs.map((docSnap) => toBusinessDocument(docSnap.id, docSnap.data())),
    });
  }

  if (kind === "notifications") {
    const snap = await db.collection(notificationsPath(businessId)).get();
    const items = snap.docs.map((docSnap) => toNotification(docSnap.id, docSnap.data()));
    return NextResponse.json({
      data: items
        .filter((item) => item.userId === actor.uid)
        .sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt)),
    });
  }

  if (kind === "activity") {
    if (!actorCan(actor, "activityLogs.view") && !actor.isSuperAdmin) {
      return NextResponse.json({ data: [] });
    }
    const snap = await db.collection(activityLogsPath(businessId)).get();
    return NextResponse.json({
      data: snap.docs.map((docSnap) => toActivityLog(docSnap.id, docSnap.data())),
    });
  }

  if (kind === "businesses") {
    if (!actor.isSuperAdmin) return NextResponse.json({ data: [] });
    const snap = await db.collection(collections.businesses).get();
    return NextResponse.json({
      data: snap.docs.map((docSnap) => toBusiness(docSnap.id, docSnap.data())),
    });
  }

  if (kind === "users") {
    if (!actor.isSuperAdmin) return NextResponse.json({ data: [] });
    const snap = await db.collection(collections.users).get();
    return NextResponse.json({
      data: snap.docs.map((docSnap) => toAppUser(docSnap.id, docSnap.data())),
    });
  }

  return NextResponse.json({ error: "UNKNOWN_KIND" }, { status: 400 });
}
