import assert from "node:assert/strict";
import { filterTaskLibrary, groupTaskLibrary, mergeTaskLibrary, taskLibraryKey } from "@/lib/admin/task-library";
import type { Task } from "@/types/task";
import type { TaskTemplate } from "@/types/task-template";

assert.equal(taskLibraryKey("  בניית דף נחיתה  ", "SYSTEMS"), "בניית דף נחיתה|SYSTEMS");
assert.equal(taskLibraryKey("בניית דף נחיתה", "OTHER_UNKNOWN"), "בניית דף נחיתה|GENERAL");
assert.equal(taskLibraryKey("בניית דף נחיתה", "SYSTEMS"), "בניית דף נחיתה|SYSTEMS");

const templates: TaskTemplate[] = [{
  id: "tpl-1",
  businessId: "b1",
  title: "בניית דף נחיתה",
  description: "תבנית",
  taskType: "SYSTEMS",
  departmentId: "d1",
  titleKey: taskLibraryKey("בניית דף נחיתה", "SYSTEMS"),
  active: true,
  createdAt: null,
  updatedAt: null,
}];

const tasks = [
  { id: "t1", title: "בניית דף נחיתה", description: "מופע ישן", taskType: "SYSTEMS", departmentId: "d1", templateId: null },
  { id: "t2", title: "צילום מוצר", description: "", taskType: "PHOTO", departmentId: null, templateId: null },
] as Task[];

const merged = mergeTaskLibrary(templates, tasks);
assert.equal(merged.length, 2);
const landing = merged.find((item) => item.title === "בניית דף נחיתה");
assert.equal(landing?.source, "template");
assert.equal(landing?.description, "תבנית");
assert.equal(landing?.templateId, "tpl-1");
assert.ok(merged.some((item) => item.title === "צילום מוצר" && item.source === "task"));

const grouped = groupTaskLibrary(filterTaskLibrary(merged, "צילום", "", ""));
assert.equal(grouped.length, 1);
assert.equal(grouped[0]?.label, "צילום");
assert.equal(grouped[0]?.items[0]?.title, "צילום מוצר");

const byType = filterTaskLibrary(merged, "", "SYSTEMS", "");
assert.equal(byType.length, 1);
assert.equal(byType[0]?.title, "בניית דף נחיתה");

console.log("TASK_LIBRARY_PASS");
