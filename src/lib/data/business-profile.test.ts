import assert from "node:assert/strict";
import {
  displayBusinessType,
  isOtherBusinessType,
  knownBusinessType,
  normalizeBusinessServices,
} from "@/lib/data/business-profile";

const fromLegacy = normalizeBusinessServices(["בניית אתרים", "  ", "עיצוב"]);
assert.equal(fromLegacy.length, 2);
assert.equal(fromLegacy[0]?.name, "בניית אתרים");
assert.equal(fromLegacy[0]?.order, 0);
assert.equal(fromLegacy[1]?.name, "עיצוב");
assert.equal(fromLegacy[1]?.description, "");

const fromObjects = normalizeBusinessServices([
  { id: "b", name: "שיווק", description: "קידום", order: 2, active: true },
  { id: "a", name: "פיתוח", description: "מערכות", order: 1, active: false },
  { name: "" },
]);
assert.equal(fromObjects.length, 2);
assert.equal(fromObjects[0]?.id, "a");
assert.equal(fromObjects[0]?.active, false);
assert.equal(fromObjects[1]?.id, "b");
assert.equal(fromObjects[1]?.order, 1);

assert.equal(isOtherBusinessType("אחר"), true);
assert.equal(displayBusinessType("חברה בע״מ"), "חברה בע״מ");
assert.equal(displayBusinessType("אחר", "קואופרטיב"), "קואופרטיב");
assert.equal(knownBusinessType("שותפות"), "שותפות");
assert.equal(knownBusinessType("קואופרטיב"), "אחר");

console.log("BUSINESS_PROFILE_PASS");
