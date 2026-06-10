"use client";

import { TasksTable } from "@/components/dashboard/TasksTable";
import { useI18n } from "@/lib/i18n/context";

export default function DashboardPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">{t("dashboard")}</h1>
      <TasksTable />
    </div>
  );
}
