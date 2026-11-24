import { notFound } from "next/navigation";
import { AssigneeHarnessClient } from "@/app/dev/assignee-harness/harness-client";

export const dynamic = "force-dynamic";

export default function AssigneeHarnessPage() {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_ASSIGNEE_HARNESS !== "1") {
    notFound();
  }
  return <AssigneeHarnessClient />;
}
