import assert from "node:assert/strict";
import {
  categoriesForDepartment,
  projectMatchesCategoryFilter,
  resolveProjectCategory,
  UNCATEGORIZED_FILTER,
  UNCATEGORIZED_LABEL,
} from "@/lib/admin/department-categories";
import type { DepartmentCategory } from "@/types/department";

const categories: DepartmentCategory[] = [
  { id: "1", businessId: "b", departmentId: "sites", name: "חנויות", isActive: true, color: "#f59e0b", createdAt: null, updatedAt: null },
  { id: "2", businessId: "b", departmentId: "sites", name: "תחזוקה", isActive: false, color: "#64748b", createdAt: null, updatedAt: null },
  { id: "3", businessId: "b", departmentId: "marketing", name: "סושיאל", isActive: true, color: "#ec4899", createdAt: null, updatedAt: null },
];

const sites = categoriesForDepartment(categories, "sites");
assert.equal(sites.length, 1);
assert.equal(sites[0]?.name, "חנויות");
assert.equal(categoriesForDepartment(categories, "marketing")[0]?.name, "סושיאל");
assert.equal(categoriesForDepartment(categories, "sites", { includeInactive: true }).length, 2);
assert.deepEqual(categoriesForDepartment(categories, ""), []);
assert.deepEqual(categoriesForDepartment(categories, null), []);

assert.equal(resolveProjectCategory({ categoryId: "1" }, categories).name, "חנויות");
assert.equal(resolveProjectCategory({ categoryId: "1", categoryName: "ישן" }, categories).name, "חנויות");
assert.equal(resolveProjectCategory({ categoryId: null, category: "ישן" }, categories).name, UNCATEGORIZED_LABEL);
assert.equal(projectMatchesCategoryFilter({ categoryId: null }, UNCATEGORIZED_FILTER), true);
assert.equal(projectMatchesCategoryFilter({ categoryId: "1" }, "1"), true);
assert.equal(projectMatchesCategoryFilter({ categoryId: "1" }, "3"), false);

console.log("DEPARTMENT_CATEGORY_SCOPE_PASS");
