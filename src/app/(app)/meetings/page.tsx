"use client";

import { Suspense } from "react";
import { MeetingsView } from "@/components/admin/meetings-view";
import { Spinner } from "@/components/ui/spinner";

export default function MeetingsPage() {
  return (
    <Suspense fallback={<Spinner label="טוען יומן פגישות…" />}>
      <MeetingsView />
    </Suspense>
  );
}
