import { asTaskKind, TASK_TYPE_LABELS, TASK_TYPES, type TaskKind } from "@/lib/admin/palette";
import type { Task } from "@/types/task";
import type { TaskTemplate } from "@/types/task-template";

export type TaskLibraryItem = {
  id: string;
  title: string;
  description: string;
  taskType: TaskKind;
  departmentId: string | null;
  source: "template" | "task";
  templateId: string | null;
};

export function taskLibraryKey(title: string, taskType: string) {
  return `${title.trim().toLowerCase().replace(/\s+/g, " ")}|${asTaskKind(taskType)}`;
}

export function mergeTaskLibrary(templates: TaskTemplate[], tasks: Task[]): TaskLibraryItem[] {
  const map = new Map<string, TaskLibraryItem>();
  for (const task of tasks) {
    const title = task.title.trim();
    if (!title) continue;
    const type = asTaskKind(task.taskType);
    const key = taskLibraryKey(title, type);
    if (map.has(key)) continue;
    map.set(key, {
      id: `task:${task.id}`,
      title,
      description: task.description,
      taskType: type,
      departmentId: task.departmentId,
      source: "task",
      templateId: task.templateId,
    });
  }
  for (const template of templates) {
    if (!template.active) continue;
    const title = template.title.trim();
    if (!title) continue;
    const type = asTaskKind(template.taskType);
    map.set(taskLibraryKey(title, type), {
      id: template.id,
      title,
      description: template.description,
      taskType: type,
      departmentId: template.departmentId,
      source: "template",
      templateId: template.id,
    });
  }
  return [...map.values()].sort((left, right) => left.title.localeCompare(right.title, "he"));
}

export function filterTaskLibrary(
  items: TaskLibraryItem[],
  query: string,
  taskType: string,
  departmentId: string,
) {
  const needle = query.trim().toLowerCase();
  return items.filter((item) => {
    if (taskType && item.taskType !== taskType) return false;
    if (departmentId && item.departmentId !== departmentId) return false;
    if (!needle) return true;
    return item.title.toLowerCase().includes(needle) || item.description.toLowerCase().includes(needle);
  });
}

export function groupTaskLibrary(items: TaskLibraryItem[]) {
  const groups = new Map<TaskKind, TaskLibraryItem[]>();
  for (const item of items) {
    const list = groups.get(item.taskType) ?? [];
    list.push(item);
    groups.set(item.taskType, list);
  }
  return TASK_TYPES
    .filter((type) => groups.has(type))
    .map((type) => ({ type, label: TASK_TYPE_LABELS[type], items: groups.get(type) ?? [] }));
}
