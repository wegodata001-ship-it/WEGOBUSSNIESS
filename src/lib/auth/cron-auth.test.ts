import assert from "node:assert/strict";
import { isCronRequestAuthorized } from "@/lib/auth/cron-auth";

function req(headers: Record<string, string>) {
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return {
    headers: {
      get: (name: string) => normalized[name.toLowerCase()] ?? null,
    },
  };
}

assert.equal(
  isCronRequestAuthorized(req({ authorization: "Bearer secret-value" }), { CRON_SECRET: "secret-value" }),
  true,
);

assert.equal(
  isCronRequestAuthorized(req({ authorization: "Bearer wrong" }), { CRON_SECRET: "secret-value" }),
  false,
);

assert.equal(
  isCronRequestAuthorized(req({ "x-vercel-cron": "1" }), { CRON_SECRET: "secret-value" }),
  false,
);

assert.equal(
  isCronRequestAuthorized(
    req({ "x-vercel-cron": "1", authorization: "Bearer secret-value" }),
    { CRON_SECRET: "secret-value" },
  ),
  true,
);

assert.equal(
  isCronRequestAuthorized(req({ authorization: "Bearer secret-value" }), { CRON_SECRET: "" }),
  false,
);

assert.equal(
  isCronRequestAuthorized(req({ authorization: "Bearer secret-value" }), {}),
  false,
);

assert.equal(
  isCronRequestAuthorized(req({ "x-vercel-cron-schedule": "*/15 * * * *" }), { CRON_SECRET: "secret-value" }),
  false,
);

assert.equal(
  isCronRequestAuthorized(req({}), { CRON_SECRET: "secret-value" }),
  false,
);

assert.equal(
  isCronRequestAuthorized(req({ authorization: "secret-value" }), { CRON_SECRET: "secret-value" }),
  false,
);

assert.equal(
  isCronRequestAuthorized(req({ authorization: "Bearer " }), { CRON_SECRET: "secret-value" }),
  false,
);

assert.equal(
  isCronRequestAuthorized(
    req({ authorization: "Bearer secret-value", "x-vercel-cron": "1" }),
    { CRON_SECRET: "  secret-value  " },
  ),
  true,
);

console.log("CRON_AUTH_PASS");
