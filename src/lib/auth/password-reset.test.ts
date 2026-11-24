import assert from "node:assert/strict";
import {
  isValidResetEmail,
  normalizeResetEmail,
  requestPasswordReset,
} from "@/lib/auth/password-reset";

async function main() {
  assert.equal(normalizeResetEmail("  Owner@Wegobiz.app "), "owner@wegobiz.app");
  assert.equal(isValidResetEmail("a@b.com"), true);
  assert.equal(isValidResetEmail(""), false);
  assert.equal(isValidResetEmail("not-an-email"), false);

  {
    const calls: Array<{ url: string; body: string }> = [];
    const outcome = await requestPasswordReset({
      email: "Siham@Example.com",
      apiKey: "test-key",
      fetchImpl: async (input, init) => {
        calls.push({
          url: String(input),
          body: typeof init?.body === "string" ? init.body : "",
        });
        return new Response(JSON.stringify({ email: "siham@example.com" }), { status: 200 });
      },
    });
    assert.equal(outcome.accepted, true);
    assert.equal(outcome.toolkitOk, true);
    assert.equal(outcome.toolkitCode, "OK");
    assert.ok(calls[0]?.url.includes("accounts:sendOobCode"));
    assert.ok(calls[0]?.url.includes("key=test-key"));
    assert.deepEqual(JSON.parse(calls[0]!.body), {
      requestType: "PASSWORD_RESET",
      email: "siham@example.com",
    });
  }

  {
    const outcome = await requestPasswordReset({
      email: "missing@example.com",
      apiKey: "test-key",
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: { message: "EMAIL_NOT_FOUND" } }), { status: 400 }),
    });
    assert.equal(outcome.accepted, true);
    assert.equal(outcome.toolkitOk, false);
    assert.equal(outcome.toolkitCode, "EMAIL_NOT_FOUND");
  }

  console.log("PASSWORD_RESET_PASS");
}

void main();
