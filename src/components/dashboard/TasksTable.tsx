"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { DuplicateTaskModal } from "./DuplicateTaskModal";
import { useI18n } from "@/lib/i18n/context";
import { copyToClipboard, formatDate, getTaskUrl } from "@/lib/utils";
import type { TaskListItem } from "@/types";

export function TasksTable() {
  const { t } = useI18n();
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks");
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleCopy = async (slug: string) => {
    const url = getTaskUrl(slug);
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopiedSlug(slug);
      setActionError("");
      setTimeout(() => setCopiedSlug(null), 2000);
    } else {
      setActionError(t("copyError"));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return;

    setDeleteId(id);
    setActionError("");
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (res.ok) {
        setTasks((prev) => prev.filter((task) => task.id !== id));
      } else {
        setActionError(t("deleteError"));
      }
    } catch {
      setActionError(t("deleteError"));
    } finally {
      setDeleteId(null);
    }
  };

  const statusCounts = tasks.reduce(
    (acc, task) => {
      acc.total += 1;
      acc[task.status] += 1;
      return acc;
    },
    { total: 0, not_started: 0, in_progress: 0, completed: 0 }
  );

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-10 w-64 animate-pulse rounded-2xl bg-gray-200/80" />
        <div className="h-72 animate-pulse rounded-2xl border border-gray-200 bg-white/70" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm sm:p-14">
        <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-xl">
          ✨
        </div>
        <p className="text-base font-medium text-gray-700">{t("noTasks")}</p>
        <Link
          href="/dashboard/create"
          className="mt-4 inline-flex items-center rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
        >
          + {t("createFirst")}
        </Link>
      </div>
    );
  }

  return (
    <>
      {actionError && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{t("dashboard")}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{statusCounts.total}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{t("statusNotStarted")}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-700">{statusCounts.not_started}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{t("statusInProgress")}</p>
          <p className="mt-1 text-2xl font-semibold text-sky-700">{statusCounts.in_progress}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{t("statusCompleted")}</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">{statusCounts.completed}</p>
        </div>
      </div>

      {/* Mobile: cards */}
      <div className="space-y-3 md:hidden">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3">
              <div className="min-w-0">
                <h3 className="font-medium text-gray-900 break-words">
                  {task.title}
                </h3>
                <p className="mt-1 text-sm text-gray-600">{task.student_name}</p>
              </div>
              <StatusBadge status={task.status} />
            </div>

            <p className="text-xs text-gray-500">
              {t("createdAt")}: {formatDate(task.created_at)}
            </p>

            <div className="rounded-xl bg-gray-50 p-2">
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => handleCopy(task.slug)}
              >
                {copiedSlug === task.slug ? t("copied") : t("copyLink")}
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <a
                href={getTaskUrl(task.slug)}
                target="_blank"
                rel="noopener noreferrer"
                className="col-span-1"
              >
                <Button variant="secondary" size="sm" className="w-full">
                  {t("open")}
                </Button>
              </a>
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => setDuplicateId(task.id)}
              >
                {t("duplicate")}
              </Button>
              <Button
                variant="danger"
                size="sm"
                className="w-full"
                onClick={() => handleDelete(task.id)}
                disabled={deleteId === task.id}
              >
                {t("delete")}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:block">
        <table className="w-full table-auto divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50/80">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t("title")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t("student")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t("createdAt")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t("status")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t("link")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t("actions")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {tasks.map((task) => (
              <tr key={task.id} className="transition hover:bg-gray-50/70">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {task.title}
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {task.student_name}
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {formatDate(task.created_at)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <StatusBadge status={task.status} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleCopy(task.slug)}
                  >
                    {copiedSlug === task.slug ? t("copied") : t("copyLink")}
                  </Button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <a
                      href={getTaskUrl(task.slug)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="secondary" size="sm">
                        {t("open")}
                      </Button>
                    </a>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setDuplicateId(task.id)}
                    >
                      {t("duplicate")}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(task.id)}
                      disabled={deleteId === task.id}
                    >
                      {t("delete")}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {duplicateId && (
        <DuplicateTaskModal
          open={!!duplicateId}
          taskId={duplicateId}
          onClose={() => setDuplicateId(null)}
          onSuccess={fetchTasks}
        />
      )}
    </>
  );
}
