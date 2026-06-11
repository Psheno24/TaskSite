"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TaskIframe, type TaskIframeHandle } from "./TaskIframe";
import { CompleteTaskButton } from "./CompleteTaskButton";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { useI18n } from "@/lib/i18n/context";
import type { TaskAnswers } from "@/types";
import type { TaskStatus } from "@/types/database";

interface PublicTask {
  slug: string;
  title: string;
  student_name: string;
  html_content: string;
  status: TaskStatus;
  answers: TaskAnswers;
}

interface StudentTaskPageProps {
  slug: string;
}

export function StudentTaskPage({ slug }: StudentTaskPageProps) {
  const { t } = useI18n();
  const iframeRef = useRef<TaskIframeHandle>(null);
  const [task, setTask] = useState<PublicTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const fetchTask = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    setNotFound(false);
    try {
      const res = await fetch(`/api/public/tasks/${slug}`);
      if (res.status === 404) {
        setNotFound(true);
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
  }, [slug]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  const handleAnswersChange = useCallback(
    async (answers: TaskAnswers, options?: { keepalive?: boolean }) => {
      const res = await fetch(`/api/public/tasks/${slug}/answers`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
        keepalive: options?.keepalive,
      });

      if (!res.ok) throw new Error("Save failed");

      const data = await res.json();
      setTask((prev) =>
        prev ? { ...prev, status: data.status } : prev
      );
    },
    [slug]
  );

  const handleBeforeComplete = useCallback(async () => {
    await iframeRef.current?.flushSave();
  }, []);

  const handleCompleted = () => {
    setTask((prev) => (prev ? { ...prev, status: "completed" } : prev));
  };

  const handleReopened = (status: PublicTask["status"]) => {
    setTask((prev) => (prev ? { ...prev, status } : prev));
  };

  if (loading) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <p className="text-gray-500 text-sm">...</p>
      </main>
    );
  }

  if (fetchError) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center px-4">
        <div className="text-center space-y-4">
          <p className="text-gray-600">{t("loadError")}</p>
          <button
            type="button"
            onClick={fetchTask}
            className="text-sm text-gray-900 underline"
          >
            {t("retry")}
          </button>
          <LanguageSwitcher />
        </div>
      </main>
    );
  }

  if (notFound || !task) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center px-4">
        <div className="text-center space-y-4">
          <p className="text-gray-600">{t("taskNotFound")}</p>
          <LanguageSwitcher />
        </div>
      </main>
    );
  }

  const isCompleted = task.status === "completed";

  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-gray-900">
            {task.title}
          </h1>
          <p className="truncate text-sm text-gray-500">{task.student_name}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <CompleteTaskButton
            slug={slug}
            status={task.status}
            onBeforeComplete={handleBeforeComplete}
            onCompleted={handleCompleted}
            onReopened={handleReopened}
          />
          <LanguageSwitcher />
        </div>
      </header>

      <TaskIframe
        ref={iframeRef}
        restoreKey={slug}
        htmlContent={task.html_content}
        initialAnswers={task.answers}
        onAnswersChange={handleAnswersChange}
        readOnly={isCompleted}
        fullscreen
        saveStatusLabel={{
          saving: t("saving"),
          saved: t("saved"),
          error: t("saveError"),
        }}
      />
    </main>
  );
}
