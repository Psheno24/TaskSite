"use client";

import type { TaskStatus } from "@/types/database";
import { useI18n } from "@/lib/i18n/context";

const statusStyles: Record<TaskStatus, string> = {
  not_started: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  in_progress: "bg-sky-100 text-sky-700 ring-1 ring-sky-200",
  completed: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
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
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[status]}`}
    >
      {t(statusKeys[status])}
    </span>
  );
}
