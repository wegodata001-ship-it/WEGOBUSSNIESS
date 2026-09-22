import { randomBytes } from "node:crypto";
import { getAdminAuth, getAdminDb, isFirebaseAdminConfigured } from "../src/lib/firebase/admin";
import { ALL_BUSINESS_PERMISSIONS, EMPLOYEE_PERMISSIONS } from "../src/lib/permissions/defaults";
import { loadProjectEnv } from "./load-env";

loadProjectEnv();

const TIMEZONE = "Asia/Jerusalem";
const BUSINESS_SLUG = "wego";
const BUSINESS_NAME = "WEGO";

const OWNER_EMAIL = "wego.biz24@gmail.com";
const TASNEEM_EMAIL = "abulieltasneem23@gmail.com";
const RESSAN_EMAIL = "ressan@gmail.com";

const DEPARTMENTS = [
  { slug: "accounts", name: "חשבונות" },
  { slug: "photography", name: "צילום" },
  { slug: "systems", name: "מערכות" },
  { slug: "management", name: "ניהול" },
] as const;

function todayInTimeZone(timeZone = TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function zonedStamp(dateOnly: string, timeOnly: string, timeZone = TIMEZONE) {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const [hour, minute] = timeOnly.split(":").map(Number);
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let index = 0; index < 4; index += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(utc));
    const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
    const hourValue = read("hour") === 24 ? 0 : read("hour");
    utc += Date.UTC(year, month - 1, day, hour, minute) - Date.UTC(read("year"), read("month") - 1, read("day"), hourValue, read("minute"));
  }
  return new Date(utc);
}

function shiftDate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return `${utcDate.getUTCFullYear()}-${String(utcDate.getUTCMonth() + 1).padStart(2, "0")}-${String(utcDate.getUTCDate()).padStart(2, "0")}`;
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

async function ensureAuthUser(email: string, displayName: string) {
  const auth = getAdminAuth();
  const existing = await auth.getUserByEmail(email).catch(() => null);
  if (existing) {
    return { uid: existing.uid, created: false, passwordSetupRequired: true };
  }

  const created = await auth.createUser({
    email,
    password: randomBytes(24).toString("base64url"),
    displayName,
    disabled: false,
    emailVerified: false,
  });

  return { uid: created.uid, created: true, passwordSetupRequired: true };
}

async function seed() {
  if (!isFirebaseAdminConfigured()) {
    console.error("WAITING_FOR_FIREBASE_CONFIG");
    process.exit(1);
  }

  const db = getAdminDb();
  const now = new Date();
  const today = todayInTimeZone();

  const existingBusiness = await db.collection("businesses").where("slug", "==", BUSINESS_SLUG).limit(1).get();
  const businessRef = existingBusiness.empty
    ? db.collection("businesses").doc()
    : existingBusiness.docs[0]!.ref;

  await businessRef.set({
    name: BUSINESS_NAME,
    slug: BUSINESS_SLUG,
    logoUrl: existingBusiness.empty ? null : existingBusiness.docs[0]!.data().logoUrl ?? null,
    primaryColor: "#2563eb",
    secondaryColor: "#0f766e",
    language: "he",
    timezone: TIMEZONE,
    status: "ACTIVE",
    ownerUserId: existingBusiness.empty ? "" : existingBusiness.docs[0]!.data().ownerUserId ?? "",
    createdAt: existingBusiness.empty ? now : existingBusiness.docs[0]!.data().createdAt ?? now,
    updatedAt: now,
  }, { merge: true });

  const businessId = businessRef.id;

  const ownerAuth = await ensureAuthUser(OWNER_EMAIL, "WEGO Owner");
  const tasneemAuth = await ensureAuthUser(TASNEEM_EMAIL, "Tasneem");
  const ressanAuth = await ensureAuthUser(RESSAN_EMAIL, "Ressan");

  const departmentsSnap = await businessRef.collection("departments").get();
  const departmentsBySlug = new Map(
    departmentsSnap.docs.map((docSnap) => [normalizeName(String(docSnap.data().slug ?? "")), docSnap]),
  );
  const departmentIds: Record<string, string> = {};

  for (const department of DEPARTMENTS) {
    const existing = departmentsBySlug.get(department.slug);
    const ref = existing?.ref ?? businessRef.collection("departments").doc();
    await ref.set({
      businessId,
      name: department.name,
      slug: department.slug,
      managerEmployeeId: existing?.data().managerEmployeeId ?? null,
      isActive: true,
      createdAt: existing?.data().createdAt ?? now,
      updatedAt: now,
    }, { merge: true });
    departmentIds[department.slug] = ref.id;
  }

  async function ensureEmployee(input: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    displayName: string;
    departmentSlug: string;
  }) {
    const employeesSnap = await businessRef.collection("employees").where("email", "==", input.email).limit(1).get();
    const ref = employeesSnap.empty
      ? businessRef.collection("employees").doc()
      : employeesSnap.docs[0]!.ref;

    await ref.set({
      businessId,
      userId: input.userId,
      firstName: input.firstName,
      lastName: input.lastName,
      displayName: input.displayName,
      email: input.email,
      phone: employeesSnap.empty ? null : employeesSnap.docs[0]!.data().phone ?? null,
      departmentId: departmentIds[input.departmentSlug],
      jobTitle: employeesSnap.empty ? null : employeesSnap.docs[0]!.data().jobTitle ?? null,
      status: "ACTIVE",
      startDate: employeesSnap.empty ? today : employeesSnap.docs[0]!.data().startDate ?? today,
      createdAt: employeesSnap.empty ? now : employeesSnap.docs[0]!.data().createdAt ?? now,
      updatedAt: now,
    }, { merge: true });

    return ref.id;
  }

  const ownerEmployeeId = await ensureEmployee({
    userId: ownerAuth.uid,
    email: OWNER_EMAIL,
    firstName: "WEGO",
    lastName: "Owner",
    displayName: "WEGO Owner",
    departmentSlug: "management",
  });
  const tasneemEmployeeId = await ensureEmployee({
    userId: tasneemAuth.uid,
    email: TASNEEM_EMAIL,
    firstName: "Tasneem",
    lastName: "",
    displayName: "Tasneem",
    departmentSlug: "systems",
  });
  const ressanEmployeeId = await ensureEmployee({
    userId: ressanAuth.uid,
    email: RESSAN_EMAIL,
    firstName: "Ressan",
    lastName: "",
    displayName: "Ressan",
    departmentSlug: "photography",
  });

  async function ensureUserAndMember(input: {
    uid: string;
    email: string;
    displayName: string;
    role: "BUSINESS_OWNER" | "EMPLOYEE";
    employeeId: string;
    permissions: string[];
  }) {
    await db.collection("users").doc(input.uid).set({
      email: input.email,
      displayName: input.displayName,
      phone: null,
      photoUrl: null,
      platformRole: null,
      defaultBusinessId: businessId,
      locale: "he",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });

    await businessRef.collection("members").doc(input.uid).set({
      userId: input.uid,
      businessId,
      employeeId: input.employeeId,
      role: input.role,
      permissions: input.permissions,
      email: input.email,
      displayName: input.displayName,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });

    await db.collection("users").doc(input.uid).collection("memberships").doc(businessId).set({
      businessId,
      role: input.role,
      isActive: true,
    }, { merge: true });
  }

  await ensureUserAndMember({
    uid: ownerAuth.uid,
    email: OWNER_EMAIL,
    displayName: "WEGO Owner",
    role: "BUSINESS_OWNER",
    employeeId: ownerEmployeeId,
    permissions: ALL_BUSINESS_PERMISSIONS,
  });
  await ensureUserAndMember({
    uid: tasneemAuth.uid,
    email: TASNEEM_EMAIL,
    displayName: "Tasneem",
    role: "EMPLOYEE",
    employeeId: tasneemEmployeeId,
    permissions: EMPLOYEE_PERMISSIONS,
  });
  await ensureUserAndMember({
    uid: ressanAuth.uid,
    email: RESSAN_EMAIL,
    displayName: "Ressan",
    role: "EMPLOYEE",
    employeeId: ressanEmployeeId,
    permissions: EMPLOYEE_PERMISSIONS,
  });

  await businessRef.set({ ownerUserId: ownerAuth.uid, updatedAt: now }, { merge: true });

  const tasks = [
    {
      seedKey: "wego-task-1",
      title: "בדיקת מערכת ניהול WEGO",
      departmentSlug: "systems",
      assigneeEmployeeId: tasneemEmployeeId,
      priority: "HIGH",
      estimatedHours: 2,
      dueOffset: 0,
      description: "בדיקה מלאה של מערכת הניהול החדשה, מעבר בין המסכים ובדיקת הרשאות משתמש.",
    },
    {
      seedKey: "wego-task-2",
      title: "בדיקת לוח עבודה יומי",
      departmentSlug: "systems",
      assigneeEmployeeId: tasneemEmployeeId,
      priority: "NORMAL",
      estimatedHours: 1,
      dueOffset: 1,
      description: "בדיקת הצגת משימות בלוח העבודה היומי, התחלת משימה וסיום משימה.",
    },
    {
      seedKey: "wego-task-3",
      title: "צילום תוכן לעסק",
      departmentSlug: "photography",
      assigneeEmployeeId: ressanEmployeeId,
      priority: "HIGH",
      estimatedHours: 3,
      dueOffset: 0,
      description: "הכנת וצילום תוכן עבור פעילות WEGO.",
    },
    {
      seedKey: "wego-task-4",
      title: "עריכת חומרי צילום",
      departmentSlug: "photography",
      assigneeEmployeeId: ressanEmployeeId,
      priority: "NORMAL",
      estimatedHours: 2,
      dueOffset: 1,
      description: "מעבר על חומרי הצילום והכנת החומרים להמשך עבודה.",
    },
    {
      seedKey: "wego-task-5",
      title: "בדיקת חשבונות חודשית",
      departmentSlug: "accounts",
      assigneeEmployeeId: ownerEmployeeId,
      priority: "NORMAL",
      estimatedHours: 2,
      dueOffset: 2,
      description: "בדיקת נתוני החשבונות והמשימות הפתוחות של העסק.",
    },
    {
      seedKey: "wego-task-6",
      title: "בדיקת ניהול עובדים ומשימות",
      departmentSlug: "management",
      assigneeEmployeeId: ownerEmployeeId,
      priority: "HIGH",
      estimatedHours: 1,
      dueOffset: 1,
      description: "בדיקת ניהול העובדים, המחלקות, ההרשאות והמשימות במערכת החדשה.",
    },
  ];

  for (const task of tasks) {
    const existing = await businessRef.collection("tasks").where("seedKey", "==", task.seedKey).limit(1).get();
    const ref = existing.empty ? businessRef.collection("tasks").doc() : existing.docs[0]!.ref;
    const dueDate = shiftDate(today, task.dueOffset);
    await ref.set({
      businessId,
      seedKey: task.seedKey,
      title: task.title,
      description: task.description,
      status: existing.empty ? "OPEN" : existing.docs[0]!.data().status ?? "OPEN",
      priority: task.priority,
      assigneeEmployeeId: task.assigneeEmployeeId,
      departmentId: departmentIds[task.departmentSlug],
      projectId: existing.empty ? null : existing.docs[0]!.data().projectId ?? null,
      estimatedHours: task.estimatedHours,
      startDate: today,
      dueDate,
      scheduledDate: today,
      createdByUserId: ownerAuth.uid,
      createdAt: existing.empty ? now : existing.docs[0]!.data().createdAt ?? now,
      updatedAt: now,
    }, { merge: true });
  }

  const projectSeeds = [
    {
      seedKey: "wego-project-1",
      name: "מערכת ניהול WEGO",
      clientName: "WEGO",
      description: "הקמה והטמעה של מערכת ניהול העסק, כולל משימות, הרשאות ולוח עבודה.",
      departmentSlug: "systems",
      managerEmployeeId: tasneemEmployeeId,
      taskKeys: ["wego-task-1", "wego-task-2", "wego-task-6"],
    },
    {
      seedKey: "wego-project-2",
      name: "תוכן וצילום",
      clientName: "WEGO",
      description: "הפקת תוכן מצולם וחומרי עריכה לפעילות העסק.",
      departmentSlug: "photography",
      managerEmployeeId: ressanEmployeeId,
      taskKeys: ["wego-task-3", "wego-task-4"],
    },
  ];

  for (const project of projectSeeds) {
    const existing = await businessRef.collection("projects").where("seedKey", "==", project.seedKey).limit(1).get();
    const ref = existing.empty ? businessRef.collection("projects").doc() : existing.docs[0]!.ref;
    await ref.set({
      businessId,
      seedKey: project.seedKey,
      name: project.name,
      clientName: project.clientName,
      description: project.description,
      status: "ACTIVE",
      departmentId: departmentIds[project.departmentSlug],
      managerEmployeeId: project.managerEmployeeId,
      startDate: today,
      dueDate: shiftDate(today, 14),
      isActive: true,
      createdAt: existing.empty ? now : existing.docs[0]!.data().createdAt ?? now,
      updatedAt: now,
    }, { merge: true });

    for (const seedKey of project.taskKeys) {
      const taskSnap = await businessRef.collection("tasks").where("seedKey", "==", seedKey).limit(1).get();
      if (!taskSnap.empty) {
        await taskSnap.docs[0]!.ref.set({ projectId: ref.id, updatedAt: now }, { merge: true });
      }
    }
  }

  const projectOne = await businessRef.collection("projects").where("seedKey", "==", "wego-project-1").limit(1).get();
  const projectOneId = projectOne.empty ? null : projectOne.docs[0]!.id;
  const meetingParticipants = [ownerEmployeeId, tasneemEmployeeId, ressanEmployeeId].filter(Boolean);
  const meetingStart = zonedStamp(today, "10:00");
  const meetingEnd = zonedStamp(today, "10:45");
  const meetingFields = {
    businessId,
    title: "סטטוס שבועי WEGO",
    description: "מעבר על משימות פתוחות, לוחות זמנים ובקשות ממתינות.",
    notes: "מעבר על משימות פתוחות, לוחות זמנים ובקשות ממתינות.",
    status: "SCHEDULED",
    startAt: meetingStart,
    endAt: meetingEnd,
    date: today,
    startTime: "10:00",
    endTime: "10:45",
    location: "משרד",
    meetingType: "TEAM",
    projectId: projectOneId,
    participantIds: meetingParticipants,
    participantEmployeeIds: meetingParticipants,
    createdBy: ownerAuth.uid,
    createdByUserId: ownerAuth.uid,
    updatedAt: now,
  };
  const existingMeeting = await businessRef.collection("meetings").where("title", "==", "סטטוס שבועי WEGO").limit(1).get();
  if (existingMeeting.empty) {
    await businessRef.collection("meetings").add({ ...meetingFields, createdAt: now });
  } else {
    await existingMeeting.docs[0]!.ref.set(meetingFields, { merge: true });
  }

  const businesses = await db.collection("businesses").where("slug", "==", BUSINESS_SLUG).get();
  const users = await Promise.all([
    db.collection("users").doc(ownerAuth.uid).get(),
    db.collection("users").doc(tasneemAuth.uid).get(),
    db.collection("users").doc(ressanAuth.uid).get(),
  ]);
  const members = await businessRef.collection("members").get();
  const employees = await businessRef.collection("employees").get();
  const departments = await businessRef.collection("departments").get();
  const allTasks = await businessRef.collection("tasks").get();
  const seededTasks = {
    size: allTasks.docs.filter((docSnap) => String(docSnap.data().seedKey ?? "").startsWith("wego-task-")).length,
  };

  const authUsers = await Promise.all([
    getAdminAuth().getUserByEmail(OWNER_EMAIL),
    getAdminAuth().getUserByEmail(TASNEEM_EMAIL),
    getAdminAuth().getUserByEmail(RESSAN_EMAIL),
  ]);

  const tasneemEmployee = employees.docs.find((docSnap) => docSnap.data().email === TASNEEM_EMAIL);
  const ressanEmployee = employees.docs.find((docSnap) => docSnap.data().email === RESSAN_EMAIL);
  const ownerMember = members.docs.find((docSnap) => docSnap.id === ownerAuth.uid);

  console.log("SEED_RESULT");
  console.log("BUSINESS_ID", businessId);
  console.log("BUSINESS_COUNT", businesses.size);
  console.log("USERS", users.filter((docSnap) => docSnap.exists).length);
  console.log("MEMBERSHIPS", members.size);
  console.log("EMPLOYEES", employees.size);
  console.log("DEPARTMENTS", departments.size);
  console.log("TASKS", seededTasks.size);
  console.log("OWNER_AUTH", Boolean(authUsers[0]));
  console.log("TASNEEM_AUTH", Boolean(authUsers[1]));
  console.log("RESSAN_AUTH", Boolean(authUsers[2]));
  console.log("OWNER_ROLE", ownerMember?.data().role ?? "MISSING");
  console.log("TASNEEM_DEPT", tasneemEmployee ? "linked" : "missing");
  console.log("RESSAN_DEPT", ressanEmployee ? "linked" : "missing");
  console.log("OWNER_PASSWORD", "PASSWORD_SETUP_REQUIRED");
  console.log("TASNEEM_PASSWORD", "PASSWORD_SETUP_REQUIRED");
  console.log("RESSAN_PASSWORD", "PASSWORD_SETUP_REQUIRED");
}

seed().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("SEED_FAILED", message.replace(/-----BEGIN[\s\S]*?-----END [A-Z ]+-----/g, "[REDACTED]"));
  process.exit(1);
});
