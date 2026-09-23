"use client";

import { Suspense } from "react";
import { SettingsControlView } from "@/components/admin/settings-view";
import { Spinner } from "@/components/ui/spinner";

export default function SettingsPage() {
  return (
    <Suspense fallback={<Spinner label="טוען הגדרות…" />}>
      <SettingsControlView />
    </Suspense>
  );
}
