import assert from "node:assert/strict";
import { isAllowedTaskFile, parseHttpsUrl } from "@/lib/admin/task-file-rules";

assert.equal(isAllowedTaskFile({ name: "brief.pdf", type: "application/pdf", size: 1200 }).ok, true);
assert.equal(isAllowedTaskFile({ name: "sheet.xlsx", type: "", size: 2048 }).ok, true);
assert.equal(isAllowedTaskFile({ name: "photo.webp", type: "image/webp", size: 800 }).ok, true);
assert.equal(isAllowedTaskFile({ name: "virus.exe", type: "application/octet-stream", size: 100 }).error, "FILE_TYPE");
assert.equal(isAllowedTaskFile({ name: "big.pdf", type: "application/pdf", size: 26 * 1024 * 1024 }).error, "FILE_TOO_LARGE");
assert.equal(parseHttpsUrl("https://drive.google.com/file/d/abc"), "https://drive.google.com/file/d/abc");
assert.equal(parseHttpsUrl("http://example.com"), null);
assert.equal(parseHttpsUrl("not-a-url"), null);
console.log("TASK_FILE_RULES_PASS");
