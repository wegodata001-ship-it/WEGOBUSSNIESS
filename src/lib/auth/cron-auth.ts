/**
 * Official Vercel cron auth: Authorization Bearer CRON_SECRET.
 * Do not treat x-vercel-cron / x-vercel-cron-schedule as credentials.
 * @see https://vercel.com/docs/cron-jobs/manage-cron-jobs
 */
export type CronAuthEnv = {
  CRON_SECRET?: string | undefined;
};

export type CronAuthRequest = {
  headers: { get(name: string): string | null };
};

export function isCronRequestAuthorized(
  request: CronAuthRequest,
  env: CronAuthEnv = { CRON_SECRET: process.env.CRON_SECRET },
): boolean {
  const secret = (env.CRON_SECRET ?? "").trim();
  if (!secret) return false;
  const header = (request.headers.get("authorization") ?? "").trim();
  return header === `Bearer ${secret}`;
}
