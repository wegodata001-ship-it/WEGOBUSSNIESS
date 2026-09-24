import assert from "node:assert/strict";
import { buildCategoryMap, categoryColorOrFallback, categoryStyles, FALLBACK_CATEGORY_COLOR } from "@/lib/admin/category-color";
import type { CatalogSetting } from "@/types/catalog-setting";

const settings: CatalogSetting[] = [
  { id: "a", businessId: "b", legacyId: "a", type: "PROJ_CATEGORY", value: "מערכות ואתרים", color: "#f7b75f", createdAt: null, updatedAt: null },
  { id: "b", businessId: "b", legacyId: "b", type: "PROJ_CATEGORY", value: "פרסום ושיווק", color: "#ec4899", createdAt: null, updatedAt: null },
];

const map = buildCategoryMap(settings, ["מערכות ואתרים", "קטגוריה לא קיימת"]);
assert.equal(map.get("מערכות ואתרים")?.color, "#f7b75f");
assert.equal(map.get("פרסום ושיווק")?.color, "#ec4899");
assert.equal(map.get("קטגוריה לא קיימת")?.color, FALLBACK_CATEGORY_COLOR);
assert.equal(categoryColorOrFallback("nope"), FALLBACK_CATEGORY_COLOR);
assert.equal(categoryStyles("#f7b75f").progress, "#f7b75f");
assert.match(categoryStyles("#f7b75f").background, /^rgba\(/);

console.log("CATEGORY_COLOR_TEST_PASS");
