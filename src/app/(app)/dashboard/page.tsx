"use client";

import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { EmployeeWorkspace } from "@/components/employee/employee-workspace";
import { useBusinessContext } from "@/components/providers/business-context";

export default function DashboardPage() {
  const { membership } = useBusinessContext();
  if (membership?.role === "EMPLOYEE") return <EmployeeWorkspace />;
  return <AdminDashboard />;
}
