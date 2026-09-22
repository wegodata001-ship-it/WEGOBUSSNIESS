"use client";

import {
  Briefcase,
  Camera,
  Code2,
  MoreHorizontal,
  Phone,
  Settings,
  CircleDot,
  Users,
} from "lucide-react";
import {
  CALENDAR_COLORS,
  CALENDAR_COLOR_META,
  PRIORITY_CHIPS,
  TASK_TYPE_LABELS,
  TASK_TYPES,
  type CalendarColor,
  type TaskKind,
} from "@/lib/admin/palette";

const TYPE_ICONS: Record<TaskKind, typeof Users> = {
  GENERAL: CircleDot,
  WORK: Briefcase,
  CALL: Phone,
  MEETING: Users,
  PHOTO: Camera,
  SYSTEMS: Code2,
  MANAGEMENT: Settings,
  OTHER: MoreHorizontal,
};

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: CalendarColor) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {CALENDAR_COLORS.map((color) => {
        const meta = CALENDAR_COLOR_META[color];
        const selected = value === color;
        return (
          <button
            key={color}
            type="button"
            title={meta.label}
            onClick={() => onChange(color)}
            className={`flex h-8 w-8 items-center justify-center rounded-full border ${selected ? "ring-2 ring-[var(--brand-primary)] ring-offset-2" : "border-transparent"}`}
            aria-label={meta.label}
          >
            <span className={`h-6 w-6 rounded-full ${meta.dot}`} />
          </button>
        );
      })}
    </div>
  );
}

export function TaskTypePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: TaskKind) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {TASK_TYPES.map((type) => {
        const Icon = TYPE_ICONS[type];
        const selected = value === type;
        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${
              selected
                ? "border-[var(--brand-primary)] bg-sky-50 font-medium text-[var(--brand-primary)]"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {TASK_TYPE_LABELS[type]}
          </button>
        );
      })}
    </div>
  );
}

export function PriorityPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const current = value === "MEDIUM" ? "NORMAL" : value;
  return (
    <div className="flex flex-wrap gap-2">
      {PRIORITY_CHIPS.map((item) => {
        const selected = current === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
              selected ? "border-slate-800 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${item.dot}`} />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
