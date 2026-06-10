"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useI18n } from "@/lib/i18n/context";
import { copyToClipboard, getTaskUrl } from "@/lib/utils";
import type { Task } from "@/types";

type InputMode = "paste" | "upload";

export function CreateTaskForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [studentName, setStudentName] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [mode, setMode] = useState<InputMode>("paste");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [createdTask, setCreatedTask] = useState<Task | null>(null);
  const [copied, setCopied] = useState(false);

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

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = t("requiredField");
    if (!studentName.trim()) newErrors.studentName = t("requiredField");
    if (!htmlContent.trim()) newErrors.htmlContent = t("invalidHtml");
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          student_name: studentName.trim(),
          html_content: htmlContent,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setErrors({ form: data.error || t("saveError") });
        return;
      }

      const task = await res.json();
      setCreatedTask(task);
    } catch {
      setErrors({ form: t("saveError") });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!createdTask) return;
    const ok = await copyToClipboard(getTaskUrl(createdTask.slug));
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (createdTask) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 space-y-4">
        <p className="font-medium text-green-800">{t("taskCreated")}</p>
        <p className="text-sm text-gray-700">
          <code>/task/{createdTask.slug}</code>
        </p>
        <div className="flex gap-2">
          <Button onClick={handleCopyLink}>
            {copied ? t("copied") : t("copyTaskLink")}
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
      <Input
        label={t("studentName")}
        value={studentName}
        onChange={(e) => setStudentName(e.target.value)}
        error={errors.studentName}
      />

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
          <div className="space-y-2">
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
                {htmlContent.length} chars loaded
              </p>
            )}
          </div>
        )}
      </div>

      {errors.form && <p className="text-sm text-red-600">{errors.form}</p>}

      <Button type="submit" disabled={loading}>
        {loading ? t("creating") : t("create")}
      </Button>
    </form>
  );
}
