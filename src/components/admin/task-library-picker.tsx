"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Field, GhostButton, inputClass } from "@/components/admin/ui";
import { filterTaskLibrary, groupTaskLibrary, type TaskLibraryItem } from "@/lib/admin/task-library";
import { TASK_TYPE_LABELS, TASK_TYPES } from "@/lib/admin/palette";
import type { Department } from "@/types/department";

export function TaskLibraryPicker({
  items,
  departments,
  onSelect,
  onFreeText,
}: {
  items: TaskLibraryItem[];
  departments: Department[];
  onSelect: (item: TaskLibraryItem) => void;
  onFreeText: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [departmentId, setDepartmentId] = useState("");

  const filtered = useMemo(
    () => filterTaskLibrary(items, query, typeFilter, departmentId),
    [departmentId, items, query, typeFilter],
  );
  const groups = useMemo(() => groupTaskLibrary(filtered), [filtered]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div className="grid gap-3" ref={rootRef}>
      <Field label="משימה">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className={`${inputClass} ps-9`}
            placeholder="חפש או בחר משימה קיימת..."
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
          />
          {open ? (
            <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
              <div className="grid gap-2 border-b border-slate-100 p-2 md:grid-cols-2">
                <select className={inputClass} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                  <option value="">כל הסוגים</option>
                  {TASK_TYPES.map((type) => (
                    <option key={type} value={type}>{TASK_TYPE_LABELS[type]}</option>
                  ))}
                </select>
                {departments.length ? (
                  <select className={inputClass} value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
                    <option value="">כל המחלקות</option>
                    {departments.filter((item) => item.isActive).map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                ) : null}
              </div>
              <div className="max-h-64 overflow-y-auto p-1">
                {groups.length ? groups.map((group) => (
                  <div key={group.type} className="mb-1">
                    <p className="px-3 py-1 text-xs font-semibold text-slate-500">{group.label}</p>
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="flex w-full rounded-xl px-3 py-2 text-start text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => {
                          onSelect(item);
                          setQuery("");
                          setOpen(false);
                        }}
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                )) : (
                  <p className="px-3 py-2 text-sm text-slate-500">אין משימות מתאימות</p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </Field>
      <GhostButton onClick={onFreeText}>+ משימה חדשה / הקלדה חופשית</GhostButton>
    </div>
  );
}
