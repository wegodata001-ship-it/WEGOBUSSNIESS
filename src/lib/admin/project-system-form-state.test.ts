import assert from "node:assert/strict";
import { resolveProjectSystemFormSync } from "@/lib/admin/project-system-form-state";
import { emptyProjectSystemDetails } from "@/types/project-system";

const incoming = { ...emptyProjectSystemDetails(), systemName: "Server" };
const typing = { ...emptyProjectSystemDetails(), systemName: "Typing…" };

// Switching projects always loads server values and clears dirty.
{
  const next = resolveProjectSystemFormSync({
    previousProjectId: "p1",
    nextProjectId: "p2",
    dirty: true,
    incoming,
    current: typing,
  });
  assert.equal(next.didReset, true);
  assert.equal(next.dirty, false);
  assert.equal(next.form.systemName, "Server");
}

// Same project + dirty must keep local typing (catalog reload / focus).
{
  const next = resolveProjectSystemFormSync({
    previousProjectId: "p1",
    nextProjectId: "p1",
    dirty: true,
    incoming,
    current: typing,
  });
  assert.equal(next.didReset, false);
  assert.equal(next.dirty, true);
  assert.equal(next.form.systemName, "Typing…");
}

// Same project + clean keeps current local snapshot (no thrash from new object refs).
{
  const next = resolveProjectSystemFormSync({
    previousProjectId: "p1",
    nextProjectId: "p1",
    dirty: false,
    incoming,
    current: typing,
  });
  assert.equal(next.didReset, false);
  assert.equal(next.form.systemName, "Typing…");
}

// First bind
{
  const next = resolveProjectSystemFormSync({
    previousProjectId: null,
    nextProjectId: "p1",
    dirty: false,
    incoming,
    current: emptyProjectSystemDetails(),
  });
  assert.equal(next.didReset, true);
  assert.equal(next.form.systemName, "Server");
}

console.log("project-system-form-state.test.ts: OK");
