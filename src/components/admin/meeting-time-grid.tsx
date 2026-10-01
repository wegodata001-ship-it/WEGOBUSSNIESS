"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CALENDAR_HOUR_END,
  CALENDAR_HOUR_START,
  MEETING_HOURS,
  PX_PER_HOUR,
  addMinutesToTime,
  durationMinutes,
  minutesFromCalendarStart,
  nowClock,
  timeFromClientY,
  weekdayIndex,
} from "@/lib/admin/meeting-time";
import { employeeName } from "@/lib/admin/catalog";
import type { CalendarEvent } from "@/lib/admin/calendar-events";
import { useI18n } from "@/components/providers/i18n-provider";
import { colorClasses, taskTypeLabel } from "@/lib/admin/palette";
import type { Employee } from "@/types/employee";
import type { Department, Project } from "@/types/department";
import { departmentName, projectName } from "@/lib/admin/catalog";
import { labelOf } from "@/lib/admin/labels";

function layoutDay(events: CalendarEvent[]) {
  const sorted = [...events].sort((left, right) => left.startTime.localeCompare(right.startTime));
  const columns: number[] = [];
  return sorted.map((event) => {
    const start = minutesFromCalendarStart(event.startTime);
    const end = start + durationMinutes(event.startTime, event.endTime);
    let col = 0;
    while (columns[col] !== undefined && columns[col]! > start) col += 1;
    columns[col] = end;
    return { event, col, cols: 0, start, end };
  }).map((item, _, all) => {
    const overlap = all.filter((other) => other.start < item.end && other.end > item.start);
    return { ...item, cols: Math.max(...overlap.map((entry) => entry.col)) + 1 };
  });
}

export function MeetingTimeGrid({
  days,
  events,
  employees,
  projects,
  departments,
  today,
  timeZone,
  canDrag,
  onSlot,
  onSelect,
  onMove,
}: {
  days: string[];
  events: CalendarEvent[];
  employees: Employee[];
  projects: Project[];
  departments: Department[];
  today: string;
  timeZone: string;
  canDrag: boolean;
  onSlot: (date: string, time: string) => void;
  onSelect: (event: CalendarEvent) => void;
  onMove: (event: CalendarEvent, date: string, startTime: string, endTime: string) => void;
}) {
  const { t } = useI18n();
  const weekLetters = [t("cal.sun"), t("cal.mon"), t("cal.tue"), t("cal.wed"), t("cal.thu"), t("cal.fri"), t("cal.sat")];
  const gridRef = useRef<HTMLDivElement>(null);
  const [clock, setClock] = useState(() => nowClock(timeZone));
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{
    id: string;
    mode: "move" | "resize";
    date: string;
    startTime: string;
    endTime: string;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(nowClock(timeZone)), 30000);
    return () => window.clearInterval(timer);
  }, [timeZone]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const day of days) map.set(day, []);
    for (const event of events) {
      if (!map.has(event.date)) continue;
      map.get(event.date)!.push(event);
    }
    return map;
  }, [days, events]);

  const hoursHeight = (CALENDAR_HOUR_END - CALENDAR_HOUR_START + 1) * PX_PER_HOUR;

  function dayFromPoint(clientX: number, clientY: number) {
    const node = document.elementFromPoint(clientX, clientY)?.closest("[data-cal-date]");
    return node instanceof HTMLElement ? node.dataset.calDate ?? null : null;
  }

  function timeFromPoint(clientY: number) {
    const grid = gridRef.current?.getBoundingClientRect();
    if (!grid) return "09:00";
    return timeFromClientY(clientY - grid.top);
  }

  function onBlockPointerDown(event: React.PointerEvent, item: CalendarEvent, mode: "move" | "resize") {
    if (!canDrag) {
      onSelect(item);
      return;
    }
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      id: item.id,
      mode,
      date: item.date,
      startTime: item.startTime,
      endTime: item.endTime || addMinutesToTime(item.startTime, 60),
      moved: false,
    });
  }

  function onBlockPointerMove(pointer: React.PointerEvent, item: CalendarEvent) {
    if (!drag || drag.id !== item.id) return;
    const nextDate = drag.mode === "move" ? (dayFromPoint(pointer.clientX, pointer.clientY) ?? drag.date) : drag.date;
    const pointerTime = timeFromPoint(pointer.clientY);
    if (drag.mode === "resize") {
      const nextEnd = pointerTime > drag.startTime ? pointerTime : addMinutesToTime(drag.startTime, 15);
      if (nextEnd !== drag.endTime) setDrag({ ...drag, endTime: nextEnd, moved: true });
      return;
    }
    const length = durationMinutes(item.startTime, item.endTime);
    if (nextDate !== drag.date || pointerTime !== drag.startTime) {
      setDrag({ ...drag, date: nextDate, startTime: pointerTime, endTime: addMinutesToTime(pointerTime, length), moved: true });
    }
  }

  function onBlockPointerUp(item: CalendarEvent) {
    if (!drag || drag.id !== item.id) return;
    if (!drag.moved) onSelect(item);
    else onMove(item, drag.date, drag.startTime, drag.endTime);
    setDrag(null);
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgb(15_23_42/0.04)]">
      <div className="min-w-max flex-1" ref={gridRef}>
        <div
          className="sticky top-0 z-20 grid border-b border-slate-200 bg-white"
          style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(132px, 1fr))` }}
        >
          <div />
          {days.map((day) => {
            const isToday = day === today;
            return (
              <div key={day} className={`border-s border-slate-100 px-2 py-3 text-center ${isToday ? "bg-sky-50" : ""}`}>
                <p className={`text-xs ${isToday ? "font-semibold text-[var(--brand-primary)]" : "text-slate-500"}`}>
                  {weekLetters[weekdayIndex(day)]}
                </p>
                <p className={`mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-lg ${isToday ? "bg-[var(--brand-primary)] font-bold text-white" : "font-semibold text-slate-900"}`}>
                  {Number(day.slice(8))}
                </p>
              </div>
            );
          })}
        </div>

        <div
          className="relative grid"
          style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(132px, 1fr))`, height: hoursHeight }}
        >
          <div className="relative">
            {MEETING_HOURS.map((hour, index) => (
              <div key={hour} className="absolute end-2 text-[11px] tabular-nums text-slate-400" dir="ltr" style={{ top: index * PX_PER_HOUR - 7 }}>
                {hour}
              </div>
            ))}
          </div>

          {days.map((day) => (
            <div
              key={day}
              data-cal-date={day}
              className={`relative border-s border-slate-100 ${day === today ? "bg-sky-50/50" : ""}`}
            >
              {MEETING_HOURS.map((hour, index) => (
                <button
                  key={hour}
                  type="button"
                  className="absolute inset-x-0 border-t border-slate-100"
                  style={{ top: index * PX_PER_HOUR, height: PX_PER_HOUR }}
                  onClick={() => onSlot(day, hour)}
                  aria-label={`${day} ${hour}`}
                />
              ))}

              {clock && clock.date === day ? (
                <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: (minutesFromCalendarStart(clock.time) / 60) * PX_PER_HOUR }}>
                  <div className="flex items-center">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                    <span className="h-px flex-1 bg-red-500" />
                    <span className="ms-1 text-[10px] font-medium text-red-500" dir="ltr">{clock.time}</span>
                  </div>
                </div>
              ) : null}

              {layoutDay(byDay.get(day) ?? []).map(({ event, col, cols, start, end }) => {
                const live = drag?.id === event.id ? drag : null;
                const top = ((live ? minutesFromCalendarStart(live.startTime) : start) / 60) * PX_PER_HOUR;
                const height = Math.max(24, ((live ? durationMinutes(live.startTime, live.endTime) : end - start) / 60) * PX_PER_HOUR - 3);
                const tone = colorClasses(event.color);
                const first = event.people[0] ? employeeName(employees, event.people[0]) : "";
                const extra = Math.max(0, event.people.length - 1);
                const typeLabel = taskTypeLabel(event.type) || labelOf(event.type);
                return (
                  <article
                    key={`${event.kind}-${event.id}`}
                    className={`absolute z-[5] overflow-hidden rounded-xl border-s-4 px-2 py-1 text-start shadow-sm ${tone.bg} ${tone.border} ${tone.text} ${canDrag ? "cursor-grab" : "cursor-pointer"}`}
                    style={{
                      top,
                      height,
                      insetInlineStart: `calc(${(col / cols) * 100}% + 4px)`,
                      width: `calc(${100 / cols}% - 8px)`,
                    }}
                    onPointerDown={(pointer) => onBlockPointerDown(pointer, event, "move")}
                    onPointerMove={(pointer) => onBlockPointerMove(pointer, event)}
                    onPointerUp={() => onBlockPointerUp(event)}
                    onMouseEnter={() => setHoverId(event.id)}
                    onMouseLeave={() => setHoverId((current) => current === event.id ? null : current)}
                  >
                    <p className="text-[11px] font-medium tabular-nums" dir="ltr">
                      {live?.startTime ?? event.startTime}{event.endTime || live ? `–${live?.endTime ?? event.endTime}` : ""}
                    </p>
                    <p className="truncate text-xs font-semibold">{event.title}</p>
                    {height > 42 && first ? (
                      <p className="truncate text-[11px] opacity-80">{first}{extra ? ` +${extra}` : ""}</p>
                    ) : null}
                    {height > 58 && event.projectId ? (
                      <p className="truncate text-[11px] opacity-70">{projectName(projects, event.projectId)}</p>
                    ) : null}
                    {canDrag ? (
                      <button
                        type="button"
                        className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
                        onPointerDown={(pointer) => onBlockPointerDown(pointer, event, "resize")}
                        aria-label={t("meetings.resize")}
                      />
                    ) : null}
                    {hoverId === event.id ? (
                      <div className="absolute start-0 top-full z-30 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-xl">
                        <p className="font-semibold text-slate-900">{event.title}</p>
                        <p className="mt-1" dir="ltr">{event.startTime}{event.endTime ? `–${event.endTime}` : ""}</p>
                        <p>{t("common.project")}: {projectName(projects, event.projectId)}</p>
                        <p>{t("common.department")}: {departmentName(departments, event.departmentId)}</p>
                        <p>{t("common.type")}: {typeLabel}</p>
                        <p>{t("meetings.participants")}: {event.people.map((id) => employeeName(employees, id)).join(", ") || "—"}</p>
                        <p>{t("common.status")}: {labelOf(event.status)}</p>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
