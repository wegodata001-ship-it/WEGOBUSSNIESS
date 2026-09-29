import { asCalendarColor, type CalendarColor } from "@/lib/admin/palette";
import type { DepartmentCategory } from "@/types/department";

export const CALENDAR_COLOR_HEX: Record<CalendarColor, string> = {
  BLUE: "#0ea5e9",
  GREEN: "#10b981",
  PURPLE: "#8b5cf6",
  ORANGE: "#f97316",
  RED: "#f43f5e",
  PINK: "#ec4899",
  YELLOW: "#f59e0b",
  CYAN: "#06b6d4",
};

export function departmentColorHex(color: string | null | undefined) {
  return CALENDAR_COLOR_HEX[asCalendarColor(color)];
}

export function categoriesForDepartment(
  categories: DepartmentCategory[],
  departmentId: string | null | undefined,
  options?: { includeInactive?: boolean },
) {
  if (!departmentId) return [];
  return categories.filter((item) => {
    if (item.departmentId !== departmentId) return false;
    return options?.includeInactive ? true : item.isActive;
  });
}

export const UNCATEGORIZED_FILTER = "uncategorized";
export const UNCATEGORIZED_LABEL = "ללא קטגוריה";

export function managedProjectCategories(
  categories: DepartmentCategory[],
  options?: { includeInactive?: boolean; includeId?: string | null },
) {
  return categories
    .filter((item) => options?.includeInactive || item.isActive || item.id === options?.includeId)
    .sort((left, right) => left.name.localeCompare(right.name, "he"));
}

export function resolveProjectCategory(
  project: { categoryId?: string | null; categoryName?: string | null; category?: string | null },
  categories: DepartmentCategory[],
) {
  if (project.categoryId) {
    const live = categories.find((item) => item.id === project.categoryId);
    return {
      id: project.categoryId,
      name: live?.name || project.categoryName || project.category || UNCATEGORIZED_LABEL,
      color: live?.color ?? null,
      assigned: true,
    };
  }
  return {
    id: null,
    name: UNCATEGORIZED_LABEL,
    color: null,
    assigned: false,
  };
}

export function projectMatchesCategoryFilter(
  project: { categoryId?: string | null },
  filter: string,
) {
  if (!filter) return true;
  if (filter === UNCATEGORIZED_FILTER) return !project.categoryId;
  return project.categoryId === filter;
}
