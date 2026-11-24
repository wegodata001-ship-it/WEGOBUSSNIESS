import { notFound } from "next/navigation";
import { MobileHarnessClient } from "@/app/dev/mobile-harness/harness-client";

export const dynamic = "force-dynamic";

export default function MobileHarnessPage() {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_ASSIGNEE_HARNESS !== "1") {
    notFound();
  }
  return <MobileHarnessClient />;
}
