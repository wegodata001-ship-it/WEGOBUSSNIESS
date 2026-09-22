import { getAdminAuth, isFirebaseAdminConfigured } from "../src/lib/firebase/admin";
import { loadProjectEnv } from "./load-env";

loadProjectEnv();

async function main() {
  if (!isFirebaseAdminConfigured()) {
    console.error("WAITING_FOR_FIREBASE_CONFIG");
    process.exit(1);
  }

  const email = process.argv[2];
  if (!email) {
    console.error("EMAIL_REQUIRED");
    process.exit(1);
  }

  const user = await getAdminAuth().getUserByEmail(email);
  const link = await getAdminAuth().generatePasswordResetLink(user.email ?? email);
  console.log("RESET_LINK_CREATED");
  console.log(link);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "FAILED";
  console.error("RESET_FAILED", message.replace(/-----BEGIN[\s\S]*?-----END [A-Z ]+-----/g, "[REDACTED]"));
  process.exit(1);
});
