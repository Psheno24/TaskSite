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
  const { t, locale } = useI18n();
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
      setTimeout(() => setCopiedSlug(null), 2000);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return;

    setDeleteId(id);
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (res.ok) {
        setTasks((prev) => prev.filter((task) => task.id !== id));
      }
    } finally {
      setDeleteId(null);
    }
  };

  if (loading) {
    return <p className="text-gray-500 text-sm">...</p>;
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
        <p className="text-gray-600">{t("noTasks")}</p>
        <Link
          href="/dashboard/create"
          className="mt-2 inline-block text-sm text-gray-900 underline"
        >
          {t("createFirst")}
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                {t("title")}
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                {t("student")}
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                {t("createdAt")}
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                {t("status")}
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                {t("link")}
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                {t("actions")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {tasks.map((task) => (
              <tr key={task.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {task.title}
                </td>
                <td className="px-4 py-3 text-gray-600">{task.student_name}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {formatDate(task.created_at, locale)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={task.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-gray-500">/task/{task.slug}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(task.slug)}
                    >
                      {copiedSlug === task.slug ? t("copied") : t("copyLink")}
                    </Button>
                  </div>
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
