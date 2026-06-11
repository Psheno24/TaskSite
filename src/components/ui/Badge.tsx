"use client";

import type { TaskStatus } from "@/types/database";
import { useI18n } from "@/lib/i18n/context";

const statusStyles: Record<TaskStatus, string> = {
  not_started: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
};

const statusKeys = {
  not_started: "statusNotStarted",
  in_progress: "statusInProgress",
  completed: "statusCompleted",
} as const;

export function StatusBadge({ status }: { status: TaskStatus }) {
  const { t } = useI18n();

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[status]}`}
    >
      {t(statusKeys[status])}
    </span>
  );
}
