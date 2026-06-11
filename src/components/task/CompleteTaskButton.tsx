"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n/context";
import type { TaskStatus } from "@/types/database";

interface CompleteTaskButtonProps {
  slug: string;
  status: TaskStatus;
  onBeforeComplete?: () => Promise<void>;
  onCompleted: () => void;
  onReopened: (status: TaskStatus) => void;
}

export function CompleteTaskButton({
  slug,
  status,
  onBeforeComplete,
  onCompleted,
  onReopened,
}: CompleteTaskButtonProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleComplete = async () => {
    setLoading(true);
    setError("");
    try {
      if (onBeforeComplete) {
        await onBeforeComplete();
      }

      const res = await fetch(`/api/public/tasks/${slug}/complete`, {
        method: "PATCH",
      });
      if (res.ok) {
        onCompleted();
      } else {
        setError(t("completeError"));
      }
    } catch {
      setError(t("completeError"));
    } finally {
      setLoading(false);
    }
  };

  const handleReopen = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/public/tasks/${slug}/reopen`, {
        method: "PATCH",
      });
      if (res.ok) {
        const data = await res.json();
        onReopened(data.status);
      } else {
        setError(t("reopenError"));
      }
    } catch {
      setError(t("reopenError"));
    } finally {
      setLoading(false);
    }
  };

  if (status === "completed") {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          size="sm"
          variant="secondary"
          onClick={handleReopen}
          disabled={loading}
        >
          {loading ? t("editing") : t("editTask")}
        </Button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" onClick={handleComplete} disabled={loading}>
        {loading ? t("completing") : t("completeTask")}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
