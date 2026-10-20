"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useI18n } from "@/lib/i18n/context";
import { prepareTaskHtml } from "@/lib/prepare-task-html";
import { copyToClipboard, createTaskSlug, getTaskUrl } from "@/lib/utils";
import type { Task } from "@/types";

type InputMode = "paste" | "upload";

type GroupMemberDraft = {
  key: string;
  slug: string;
  name: string;
};

const DEFAULT_GROUP_SIZE = 2;
const MIN_GROUP_SIZE = 2;
const MAX_GROUP_SIZE = 50;

function makeMember(index: number): GroupMemberDraft {
  return {
    key: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    slug: createTaskSlug(),
    name: "",
  };
}

function resizeMembers(
  current: GroupMemberDraft[],
  nextSize: number
): GroupMemberDraft[] {
  const size = Math.min(MAX_GROUP_SIZE, Math.max(MIN_GROUP_SIZE, nextSize));
  if (size === current.length) return current;
  if (size < current.length) return current.slice(0, size);
  const next = [...current];
  while (next.length < size) {
    next.push(makeMember(next.length));
  }
  return next;
}

export function CreateTaskForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [studentName, setStudentName] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [mode, setMode] = useState<InputMode>("paste");
  const [isGroup, setIsGroup] = useState(false);
  const [groupSize, setGroupSize] = useState(DEFAULT_GROUP_SIZE);
  const [members, setMembers] = useState<GroupMemberDraft[]>(() =>
    Array.from({ length: DEFAULT_GROUP_SIZE }, (_, i) => makeMember(i))
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [createdTask, setCreatedTask] = useState<Task | null>(null);
  const [createdGroup, setCreatedGroup] = useState<Task[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [htmlWarnings, setHtmlWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (!isGroup) return;
    setMembers((prev) => resizeMembers(prev, groupSize));
  }, [groupSize, isGroup]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".html") && !file.name.endsWith(".htm")) {
      setErrors({ file: t("onlyHtmlFiles") });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setHtmlContent(content);
      setErrors({});
    };
    reader.onerror = () => {
      setErrors({ file: t("fileReadError") });
    };
    reader.readAsText(file);
  };

  const setGroupSizeClamped = (value: number) => {
    const next = Math.min(
      MAX_GROUP_SIZE,
      Math.max(MIN_GROUP_SIZE, Number.isFinite(value) ? value : MIN_GROUP_SIZE)
    );
    setGroupSize(next);
  };

  const updateMemberName = (key: string, name: string) => {
    setMembers((prev) =>
      prev.map((member) => (member.key === key ? { ...member, name } : member))
    );
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = t("requiredField");
    if (!isGroup && !studentName.trim()) {
      newErrors.studentName = t("requiredField");
    }
    if (!htmlContent.trim()) newErrors.htmlContent = t("invalidHtml");
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setHtmlWarnings([]);
    try {
      const { html: preparedHtml, warnings } = prepareTaskHtml(htmlContent);
      if (warnings.length > 0) {
        setHtmlWarnings(warnings);
      }

      const payload = isGroup
        ? {
            title: title.trim(),
            html_content: preparedHtml,
            is_group: true,
            members: members.map((member, index) => ({
              slug: member.slug,
              student_name: member.name.trim() || String(index + 1),
            })),
          }
        : {
            title: title.trim(),
            student_name: studentName.trim(),
            html_content: preparedHtml,
          };

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setErrors({ form: data.error || t("saveError") });
        return;
      }

      const data = await res.json();
      if (isGroup && Array.isArray(data.tasks)) {
        setCreatedGroup(data.tasks as Task[]);
      } else {
        setCreatedTask(data as Task);
      }
    } catch {
      setErrors({ form: t("saveError") });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async (slug: string) => {
    const ok = await copyToClipboard(getTaskUrl(slug));
    if (ok) {
      setCopied(slug);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  if (createdGroup) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-6 shadow-sm space-y-4">
        <p className="font-medium text-green-800">{t("groupCreated")}</p>
        <ul className="space-y-3">
          {createdGroup.map((task) => (
            <li
              key={task.id}
              className="rounded-xl border border-green-100 bg-white/80 p-3 space-y-2"
            >
              <p className="text-sm font-medium text-gray-800">
                {task.student_name}
              </p>
              <p className="text-sm text-gray-700">
                <code>/task/{task.slug}</code>
              </p>
              <Button size="sm" onClick={() => handleCopyLink(task.slug)}>
                {copied === task.slug ? t("copied") : t("copyTaskLink")}
              </Button>
            </li>
          ))}
        </ul>
        <Button variant="secondary" onClick={() => router.push("/dashboard")}>
          {t("goToDashboard")}
        </Button>
      </div>
    );
  }

  if (createdTask) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-6 shadow-sm space-y-4">
        <p className="font-medium text-green-800">{t("taskCreated")}</p>
        <p className="text-sm text-gray-700">
          <code>/task/{createdTask.slug}</code>
        </p>
        <div className="flex gap-2">
          <Button onClick={() => handleCopyLink(createdTask.slug)}>
            {copied === createdTask.slug ? t("copied") : t("copyTaskLink")}
          </Button>
          <Button variant="secondary" onClick={() => router.push("/dashboard")}>
            {t("goToDashboard")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <Input
        label={t("taskTitle")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        error={errors.title}
      />

      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <input
          type="checkbox"
          checked={isGroup}
          onChange={(e) => setIsGroup(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500"
        />
        {t("groupWithAnswers")}
      </label>

      {isGroup ? (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
          <div className="space-y-1">
            <span className="block text-sm font-medium text-gray-700">
              {t("groupSize")}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setGroupSizeClamped(groupSize - 1)}
                disabled={groupSize <= MIN_GROUP_SIZE}
                aria-label="-"
              >
                −
              </Button>
              <input
                type="number"
                min={MIN_GROUP_SIZE}
                max={MAX_GROUP_SIZE}
                value={groupSize}
                onChange={(e) => setGroupSizeClamped(Number(e.target.value))}
                className="w-20 rounded-md border border-gray-300 px-3 py-2 text-center text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setGroupSizeClamped(groupSize + 1)}
                disabled={groupSize >= MAX_GROUP_SIZE}
                aria-label="+"
              >
                +
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {members.map((member, index) => (
              <div
                key={member.key}
                className="grid gap-3 rounded-lg border border-gray-100 bg-gray-50/80 p-3 sm:grid-cols-[1fr_1.2fr]"
              >
                <div className="space-y-1">
                  <span className="block text-xs font-medium uppercase tracking-wide text-gray-500">
                    {t("groupMemberLink")}
                  </span>
                  <code className="block break-all text-xs text-gray-700 sm:text-sm">
                    /task/{member.slug}
                  </code>
                </div>
                <Input
                  label={`${t("groupMemberName")} ${index + 1}`}
                  value={member.name}
                  placeholder={String(index + 1)}
                  onChange={(e) => updateMemberName(member.key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Input
          label={t("studentName")}
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          error={errors.studentName}
        />
      )}

      <div>
        <div className="mb-3 flex gap-2">
          <Button
            type="button"
            variant={mode === "paste" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setMode("paste")}
          >
            {t("pasteHtml")}
          </Button>
          <Button
            type="button"
            variant={mode === "upload" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setMode("upload")}
          >
            {t("uploadFile")}
          </Button>
        </div>

        {mode === "paste" ? (
          <Textarea
            label={t("htmlContent")}
            value={htmlContent}
            onChange={(e) => setHtmlContent(e.target.value)}
            rows={16}
            error={errors.htmlContent}
          />
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {t("chooseFile")}
            </label>
            <input
              type="file"
              accept=".html,.htm"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-600"
            />
            {errors.file && (
              <p className="text-sm text-red-600">{errors.file}</p>
            )}
            {htmlContent && (
              <p className="text-sm text-green-600">
                {htmlContent.length} {t("charsLoaded")}
              </p>
            )}
          </div>
        )}
      </div>

      {htmlWarnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 space-y-1">
          <p className="font-medium">{t("htmlWarningsTitle")}</p>
          <ul className="list-disc pl-5 space-y-1">
            {htmlWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {errors.form && <p className="text-sm text-red-600">{errors.form}</p>}

      <Button type="submit" disabled={loading}>
        {loading ? t("creating") : t("create")}
      </Button>
    </form>
  );
}
