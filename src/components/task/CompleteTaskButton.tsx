"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n/context";
import type { TaskStatus } from "@/types/database";

interface CompleteTaskButtonProps {
  slug: string;
  status: TaskStatus;
  onCompleted: () => void;
  onReopened: (status: TaskStatus) => void;
}

export function CompleteTaskButton({
  slug,
  status,
  onCompleted,
  onReopened,
}: CompleteTaskButtonProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/public/tasks/${slug}/complete`, {
        method: "PATCH",
      });
      if (res.ok) {
        onCompleted();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReopen = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/public/tasks/${slug}/reopen`, {
        method: "PATCH",
      });
      if (res.ok) {
        const data = await res.json();
        onReopened(data.status);
      }
    } finally {
      setLoading(false);
    }
  };

  if (status === "completed") {
    return (
      <Button
        size="sm"
        variant="secondary"
        onClick={handleReopen}
        disabled={loading}
      >
        {loading ? t("editing") : t("editTask")}
      </Button>
    );
  }

  return (
    <Button size="sm" onClick={handleComplete} disabled={loading}>
      {loading ? t("completing") : t("completeTask")}
    </Button>
  );
}
