"use client";

import { CreateTaskForm } from "@/components/dashboard/CreateTaskForm";
import { useI18n } from "@/lib/i18n/context";

export default function CreateTaskPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">{t("createTask")}</h1>
      <CreateTaskForm />
    </div>
  );
}
