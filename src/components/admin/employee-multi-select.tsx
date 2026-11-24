"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { departmentName } from "@/lib/admin/catalog";
import { employeeInitials } from "@/lib/admin/task-team";
import { uniqueParticipantIds } from "@/lib/admin/task-participants";
import type { Department } from "@/types/department";
import type { Employee } from "@/types/employee";

export function EmployeeAvatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const box = size === "md" ? "h-8 w-8 text-xs" : "h-6 w-6 text-[10px]";
  return (
    <span className={`inline-flex ${box} shrink-0 items-center justify-center rounded-full bg-slate-800 font-semibold text-white`}>
      {employeeInitials(name)}
    </span>
  );
}

function sameIds(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  return a.every((id, index) => id === b[index]);
}

/**
 * Controlled multi-select that keeps an optimistic local selection so a parent
 * re-render with a briefly stale value cannot blank the chips mid-interaction.
 * Values are always employee document ids (never Firebase Auth UIDs).
 */
export function EmployeeMultiSelect({
  employees,
  departments,
  value,
  onChange,
  excludeIds = [],
  disabled,
  placeholder = "חפש ותייג עובדים...",
}: {
  employees: Employee[];
  departments: Department[];
  value: string[];
  onChange: (next: string[]) => void;
  excludeIds?: string[];
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const pendingCommitRef = useRef<string[] | null>(null);
  const valueKey = value.join("|");
  const [selectedIds, setSelectedIds] = useState<string[]>(() => uniqueParticipantIds(value));

  useEffect(() => {
    const incoming = uniqueParticipantIds(value);
    const pending = pendingCommitRef.current;
    if (pending) {
      // Ignore stale parent props until they catch up to the last local commit.
      if (sameIds(incoming, pending)) {
        pendingCommitRef.current = null;
        setSelectedIds(incoming);
      }
      return;
    }
    setSelectedIds(incoming);
  }, [valueKey, value]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const options = useMemo(() => {
    const excluded = new Set(excludeIds);
    return employees.filter((employee) => {
      if (employee.status === "INACTIVE") return false;
      if (excluded.has(employee.id)) return false;
      if (!query.trim()) return true;
      const haystack = `${employee.displayName} ${employee.email ?? ""} ${departmentName(departments, employee.departmentId)}`.toLowerCase();
      return haystack.includes(query.trim().toLowerCase());
    });
  }, [departments, employees, excludeIds, query]);

  const byId = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);
  const selected = useMemo(() => {
    return selectedIds.map((id) => {
      const employee = byId.get(id);
      return {
        id,
        displayName: employee?.displayName || id,
      };
    });
  }, [byId, selectedIds]);

  function commit(next: string[]) {
    const unique = uniqueParticipantIds(next);
    pendingCommitRef.current = unique;
    setSelectedIds(unique);
    onChange(unique);
  }

  function toggle(id: string) {
    if (disabled) return;
    const employeeId = id.trim();
    if (!employeeId) return;
    commit(
      selectedIds.includes(employeeId)
        ? selectedIds.filter((item) => item !== employeeId)
        : [...selectedIds, employeeId],
    );
  }

  return (
    <div className="relative" ref={rootRef} data-testid="employee-multi-select">
      <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-2">
        {selected.map((employee) => (
          <span
            key={employee.id}
            data-testid={`employee-chip-${employee.id}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pe-1 ps-1 text-xs font-medium text-slate-700"
          >
            <EmployeeAvatar name={employee.displayName} />
            {employee.displayName}
            {disabled ? null : (
              <button
                type="button"
                data-testid={`employee-remove-${employee.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  toggle(employee.id);
                }}
                className="rounded-full p-0.5 hover:bg-slate-200"
                aria-label={`הסרת ${employee.displayName}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        <button
          type="button"
          disabled={disabled}
          data-testid="employee-multi-select-open"
          onClick={() => setOpen((state) => !state)}
          className="inline-flex min-h-10 items-center gap-1 rounded-full px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 disabled:opacity-50 touch-manipulation"
        >
          <Plus className="h-3 w-3" />
          {selected.length ? "הוסף עובד" : placeholder}
        </button>
      </div>

      {open && !disabled ? (
        <div
          className="absolute z-[60] mt-2 max-h-[min(18rem,45dvh)] w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
          data-testid="employee-multi-select-menu"
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder}
              className="h-10 w-full bg-transparent text-sm outline-none"
              data-testid="employee-multi-select-search"
            />
          </div>
          <div className="max-h-[min(14rem,38dvh)] overflow-y-auto overscroll-contain p-1">
            {options.length ? options.map((employee) => {
              const checked = selectedIds.includes(employee.id);
              return (
                <button
                  key={employee.id}
                  type="button"
                  data-testid={`employee-option-${employee.id}`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    toggle(employee.id);
                    setQuery("");
                  }}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 py-2.5 text-start hover:bg-slate-50 touch-manipulation"
                >
                  <span className={`flex h-5 w-5 items-center justify-center rounded border ${checked ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white" : "border-slate-300"}`}>
                    {checked ? <Check className="h-3 w-3" /> : null}
                  </span>
                  <EmployeeAvatar name={employee.displayName} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{employee.displayName}</span>
                    <span className="block truncate text-xs text-slate-500">{departmentName(departments, employee.departmentId)}</span>
                  </span>
                </button>
              );
            }) : (
              <p className="px-3 py-4 text-sm text-slate-500">לא נמצאו עובדים</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function CollaboratorAvatars({
  employees,
  ids,
}: {
  employees: Employee[];
  ids: string[];
}) {
  const [open, setOpen] = useState(false);
  const people = ids.map((id) => employees.find((item) => item.id === id)).filter(Boolean) as Employee[];
  if (!people.length) return null;
  const shown = people.slice(0, 2);
  const extra = people.length - shown.length;
  const names = people.map((item) => item.displayName).join(", ");

  return (
    <span className="relative inline-flex items-center" title={names}>
      <button type="button" className="inline-flex items-center" onClick={() => setOpen((state) => !state)}>
        {shown.map((employee) => (
          <span key={employee.id} className="-ms-1 first:ms-0" title={employee.displayName}>
            <EmployeeAvatar name={employee.displayName} />
          </span>
        ))}
        {extra > 0 ? <span className="ms-1 text-[11px] text-slate-500">+{extra}</span> : null}
      </button>
      {open ? (
        <span className="absolute start-0 top-full z-20 mt-1 min-w-40 rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-700 shadow-lg">
          {people.map((employee) => (
            <span key={employee.id} className="flex items-center gap-2 py-1">
              <EmployeeAvatar name={employee.displayName} />
              {employee.displayName}
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
}
