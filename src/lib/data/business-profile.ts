import { BUSINESS_LEGAL_TYPES, type BusinessService } from "@/types/notification";

export function emptyBusinessService(order = 0): BusinessService {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `svc-${Date.now()}-${order}`;
  return { id, name: "", description: "", order, active: true };
}

export function normalizeBusinessServices(value: unknown): BusinessService[] {
  if (!Array.isArray(value)) return [];
  const next: BusinessService[] = [];
  value.forEach((item, index) => {
    if (typeof item === "string") {
      const name = item.trim();
      if (!name) return;
      next.push({ id: `svc-${index + 1}`, name, description: "", order: index, active: true });
      return;
    }
    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!name) return;
    const order = typeof record.order === "number" && Number.isFinite(record.order) ? record.order : index;
    next.push({
      id: typeof record.id === "string" && record.id.trim() ? record.id.trim() : `svc-${index + 1}`,
      name,
      description: typeof record.description === "string" ? record.description.trim() : "",
      nameAr: typeof record.nameAr === "string" ? record.nameAr.trim() : "",
      descriptionAr: typeof record.descriptionAr === "string" ? record.descriptionAr.trim() : "",
      order,
      active: record.active !== false,
    });
  });
  return next
    .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name, "he"))
    .map((item, index) => ({ ...item, order: index }));
}

export function isOtherBusinessType(legalType: string) {
  return legalType === "אחר" || legalType === "OTHER";
}

export function displayBusinessType(legalType: string, customBusinessType = "") {
  if (isOtherBusinessType(legalType)) return customBusinessType.trim() || "אחר";
  return legalType.trim();
}

export function knownBusinessType(value: string) {
  return BUSINESS_LEGAL_TYPES.includes(value as (typeof BUSINESS_LEGAL_TYPES)[number])
    ? value
    : value
      ? "אחר"
      : "";
}
