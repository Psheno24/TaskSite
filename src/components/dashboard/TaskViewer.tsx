"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TaskIframe } from "@/components/task/TaskIframe";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n/context";
import { formatDate } from "@/lib/utils";
import type { TaskWithAnswers, TaskAnswers } from "@/types";

interface TaskViewerProps {
  taskId: string;
}

export function TaskViewer({ taskId }: TaskViewerProps) {
  const { t } = useI18n();
  const [task, setTask] = useState<TaskWithAnswers | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);

  const fetchTask = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (res.status === 404) {
        setTask(null);
        return;
      }
      if (!res.ok) {
        setFetchError(true);
        return;
      }
      const data = await res.json();
      setTask(data);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  const handleAnswersChange = useCallback(
    async (answers: TaskAnswers) => {
      const res = await fetch(`/api/tasks/${taskId}/answers`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });

      if (!res.ok) throw new Error("Save failed");

      const data = await res.json();
      setTask((prev) =>
        prev ? { ...prev, status: data.status } : prev
      );
    },
    [taskId]
  );

  if (loading) {
    return <p className="text-gray-500 text-sm">...</p>;
  }

  if (fetchError) {
    return (
      <div className="space-y-2">
        <p className="text-red-600">{t("loadError")}</p>
        <Button variant="secondary" size="sm" onClick={fetchTask}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (!task) {
    return <p className="text-red-600">{t("taskNotFound")}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">
            ← {t("backToDashboard")}
          </Button>
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-xl font-semibold text-gray-900">{task.title}</h1>
          <StatusBadge status={task.status} />
        </div>
        <div className="flex flex-wrap gap-6 text-sm text-gray-600">
          <span>
            {t("student")}: <strong>{task.student_name}</strong>
          </span>
          <span>
            {t("createdAt")}: {formatDate(task.created_at)}
          </span>
          <span>
            {t("updatedAt")}: {formatDate(task.updated_at)}
          </span>
        </div>
      </div>

      <TaskIframe
        restoreKey={taskId}
        htmlContent={task.html_content}
        initialAnswers={task.answers}
        onAnswersChange={handleAnswersChange}
        readOnly={false}
        saveStatusLabel={{
          saving: t("saving"),
          saved: t("saved"),
          error: t("saveError"),
        }}
      />

      <div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowAnswers(!showAnswers)}
        >
          {t("answers")} {showAnswers ? "▲" : "▼"}
        </Button>
        {showAnswers && (
          <pre className="mt-2 overflow-auto rounded-md bg-gray-50 p-4 text-xs text-gray-700 border border-gray-200">
            {JSON.stringify(task.answers, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
