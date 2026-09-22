import { getAdminAuth, isFirebaseAdminConfigured } from "../src/lib/firebase/admin";
import { loadProjectEnv } from "./load-env";

loadProjectEnv();

const ACCOUNTS = [
  { email: "wego.biz24@gmail.com", password: process.env.BOOTSTRAP_OWNER_PASSWORD ?? "" },
  { email: "abulieltasneem23@gmail.com", password: process.env.BOOTSTRAP_TASNEEM_PASSWORD ?? "" },
  { email: "ressan@gmail.com", password: process.env.BOOTSTRAP_RESSAN_PASSWORD ?? "" },
];

async function main() {
  if (!isFirebaseAdminConfigured()) {
    console.error("WAITING_FOR_FIREBASE_CONFIG");
    process.exit(1);
  }

  const missing = ACCOUNTS.filter((account) => !account.password);
  if (missing.length) {
    console.error("PASSWORDS_MISSING");
    process.exit(1);
  }

  const auth = getAdminAuth();
  for (const account of ACCOUNTS) {
    const user = await auth.getUserByEmail(account.email);
    await auth.updateUser(user.uid, {
      password: account.password,
      disabled: false,
    });
    console.log("UPDATED", account.email);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "FAILED";
  console.error("SET_PASSWORD_FAILED", message.replace(/-----BEGIN[\s\S]*?-----END [A-Z ]+-----/g, "[REDACTED]"));
  process.exit(1);
});
