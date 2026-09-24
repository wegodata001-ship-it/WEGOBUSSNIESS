import { NextResponse } from "next/server";
import { canSeeTaskDoc } from "@/lib/admin/task-access";
import { canViewTaskFinance } from "@/lib/finance/access";
import { hideTaskFinance } from "@/lib/finance/public-task";
import { toTimestamp } from "@/lib/dates/timestamp";
import { actorCan, requireActor } from "@/lib/auth/server-actor";
import {
  toActivityLog,
  toAppUser,
  toBusiness,
  toDepartment,
  toEmployee,
  toLogisticsRequest,
  toBusinessDocument,
  toMeeting,
  toMembership,
  toNotification,
  toProject,
  toBusinessSettings,
  toPaymentRecord,
  toTask,
  toWorkSession,
} from "@/lib/firebase/converters";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  activityLogsPath,
  businessMembersPath,
  collections,
  departmentsPath,
  documentsPath,
  employeesPath,
  logisticsRequestsPath,
  businessSettingsDocPath,
  meetingsPath,
  notificationsPath,
  paymentsPath,
  projectsPath,
  tasksPath,
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
    const snap = await db.collection(tasksPath(businessId)).get();
    const tasks = snap.docs.map((docSnap) => toTask(docSnap.id, docSnap.data()));
    const visible = tasks.filter((task) => canSeeTaskDoc(actor, task));
    const canSeeMoney = canViewTaskFinance(actor);
    return NextResponse.json({
      data: canSeeMoney ? visible : visible.map(hideTaskFinance),
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
    const snap = await db.collection(meetingsPath(businessId)).get();
    return NextResponse.json({
      data: snap.docs.map((docSnap) => toMeeting(docSnap.id, docSnap.data())),
    });
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
    if (!actorCan(actor, "projects.view") && !actor.isSuperAdmin) {
      return NextResponse.json({ data: [] });
    }
    const snap = await db.collection(projectsPath(businessId)).get();
    return NextResponse.json({
      data: snap.docs.map((docSnap) => toProject(docSnap.id, docSnap.data())),
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
