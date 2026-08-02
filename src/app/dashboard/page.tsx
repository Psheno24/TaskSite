"use client";

import { TasksTable } from "@/components/dashboard/TasksTable";
import { useI18n } from "@/lib/i18n/context";

export default function DashboardPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white via-white to-slate-50 p-5 shadow-sm sm:p-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {t("appName")}
          </p>
          <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">{t("dashboard")}</h1>
          <p className="max-w-2xl text-sm text-gray-600 sm:text-base">{t("dashboardSubtitle")}</p>
        </div>
      </section>

      <TasksTable />
    </div>
  );
}
