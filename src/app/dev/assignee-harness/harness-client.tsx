"use client";

import { useMemo, useRef, useState } from "react";
import { emptyTaskDraft, TaskFormModal, taskDraftPayload, type TaskDraft } from "@/components/admin/task-form-modal";
import { I18nProvider } from "@/components/providers/i18n-provider";
import type { Department } from "@/types/department";
import type { Employee } from "@/types/employee";

const SIHAM_EMPLOYEE_ID = "emp-siham-doc";
const OWNER_EMPLOYEE_ID = "emp-owner-doc";
const SIHAM_AUTH_UID = "auth-uid-siham-NOT-FOR-ASSIGN";

function mockEmployee(partial: Partial<Employee> & Pick<Employee, "id" | "displayName">): Employee {
  return {
    businessId: "biz-harness",
    userId: partial.userId ?? null,
    uid: partial.uid ?? null,
    firstName: partial.firstName ?? partial.displayName.split(" ")[0] ?? "",
    lastName: partial.lastName ?? partial.displayName.split(" ").slice(1).join(" "),
    name: partial.displayName,
    email: partial.email ?? null,
    phone: null,
    departmentId: partial.departmentId ?? "dept-1",
    jobTitle: null,
    role: partial.role ?? "EMPLOYEE",
    status: "ACTIVE",
    active: true,
    startDate: null,
    createdAt: null,
    updatedAt: null,
    ...partial,
  };
}

const employees: Employee[] = [
  mockEmployee({
    id: OWNER_EMPLOYEE_ID,
    displayName: "WEGO Owner",
    role: "OWNER",
    userId: "auth-uid-owner",
    uid: "auth-uid-owner",
  }),
  mockEmployee({
    id: SIHAM_EMPLOYEE_ID,
    displayName: "סיהאם דבור",
    firstName: "סיהאם",
    lastName: "דבור",
    userId: SIHAM_AUTH_UID,
    uid: SIHAM_AUTH_UID,
    email: "siham@example.com",
  }),
];

const departments: Department[] = [
  {
    id: "dept-1",
    businessId: "biz-harness",
    name: "משרד",
    slug: "office",
    description: "",
    color: "BLUE",
    managerEmployeeId: null,
    isActive: true,
    createdAt: null,
    updatedAt: null,
  },
];

export function AssigneeHarnessClient() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [draft, setDraft] = useState<TaskDraft>(() => emptyTaskDraft(today));
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [savedPayload, setSavedPayload] = useState<ReturnType<typeof taskDraftPayload> | null>(null);
  const [open, setOpen] = useState(true);

  return (
    <I18nProvider locale="he" persist={false}>
      <main className="min-h-screen bg-slate-100 p-6" data-testid="assignee-harness">
        <h1 className="mb-4 text-xl font-semibold text-slate-900">Assignee harness</h1>
        <p className="mb-2 text-sm text-slate-600">
          Siham employee doc id: <code data-testid="siham-employee-id">{SIHAM_EMPLOYEE_ID}</code>
        </p>
        <p className="mb-4 text-sm text-slate-600">
          Draft assigneeId: <code data-testid="draft-assignee-id">{draft.assigneeId || "(empty)"}</code>
          {" | "}
          collaborators: <code data-testid="draft-collaborators">{draft.collaboratorIds.join(",") || "(none)"}</code>
        </p>
        {savedPayload ? (
          <pre className="mb-4 overflow-auto rounded-xl bg-white p-3 text-xs" data-testid="saved-payload">
            {JSON.stringify(savedPayload, null, 2)}
          </pre>
        ) : null}
        <button
          type="button"
          className="mb-4 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
          data-testid="reopen-task-form"
          onClick={() => setOpen(true)}
        >
          Open task form
        </button>
        {open ? (
          <TaskFormModal
            draft={draft}
            onChange={setDraft}
            onClose={() => setOpen(false)}
            onSave={async (current) => {
              setDraft(current);
              draftRef.current = current;
              const payload = taskDraftPayload(current);
              setSavedPayload(payload);
              const id = current.id || "task-harness-1";
              setDraft((prev) => ({ ...prev, id }));
              return { ok: true, id };
            }}
            onSaved={() => setOpen(false)}
            busy={false}
            businessId="biz-harness"
            employees={employees}
            departments={departments}
            projects={[]}
            canEditTeam
            canCreateProject={false}
            canCreateDepartment={false}
            canSetPrice={false}
            onCatalogRefresh={async () => undefined}
          />
        ) : null}
      </main>
    </I18nProvider>
  );
}
