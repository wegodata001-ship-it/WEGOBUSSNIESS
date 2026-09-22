import { loadProjectEnv } from "./load-env";

loadProjectEnv();

const PASSWORDS: Record<string, string> = {
  "wego.biz24@gmail.com": process.env.BOOTSTRAP_OWNER_PASSWORD ?? "",
  "abulieltasneem23@gmail.com": process.env.BOOTSTRAP_TASNEEM_PASSWORD ?? "",
  "ressan@gmail.com": process.env.BOOTSTRAP_RESSAN_PASSWORD ?? "",
};

async function main() {
  const email = (process.argv[2] || "").trim().toLowerCase();
  const password = PASSWORDS[email] ?? "";
  if (!email || !password) {
    console.error("USAGE_KNOWN_EMAIL");
    process.exit(1);
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  if (!apiKey) {
    console.error("MISSING_API_KEY");
    process.exit(1);
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const payload = (await response.json()) as {
    idToken?: string;
    error?: { message?: string; code?: number };
  };

  console.log("PASSWORD_SIGNIN", payload.idToken ? "PASS" : "FAIL");
  console.log("HTTP", response.status);
  if (!payload.idToken) {
    console.log("AUTH_ERROR", payload.error?.message ?? "unknown");
    process.exit(1);
  }

  const resolveResponse = await fetch("http://localhost:3000/api/session/resolve", {
    headers: { Authorization: `Bearer ${payload.idToken}` },
  });
  const resolved = (await resolveResponse.json()) as { status?: string; reason?: string; membership?: { role?: string } };
  console.log("RESOLVE_STATUS", resolved.status ?? "MISSING");
  console.log("RESOLVE_REASON", resolved.reason ?? "none");
  console.log("RESOLVE_ROLE", resolved.membership?.role ?? "MISSING");

  const loginResponse = await fetch("http://localhost:3000/api/session/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const loginPayload = (await loginResponse.json()) as { status?: string; reason?: string; membership?: { role?: string } };
  console.log("LOGIN_API", loginResponse.status);
  console.log("LOGIN_STATUS", loginPayload.status ?? "MISSING");
  console.log("LOGIN_ROLE", loginPayload.membership?.role ?? "MISSING");
}

main().catch((error) => {
  console.error("DIAGNOSE_FAILED", error instanceof Error ? error.message : "error");
  process.exit(1);
});
