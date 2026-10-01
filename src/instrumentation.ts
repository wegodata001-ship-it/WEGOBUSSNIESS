export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { validateMailEnv } = await import("@/lib/mail/send");
  const checked = validateMailEnv();
  if (!checked.ok) {
    console.error(`[WEGO MAIL] ${checked.error}`);
  }
}
