"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useI18n } from "@/lib/i18n/context";

interface DuplicateTaskModalProps {
  open: boolean;
  taskId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function DuplicateTaskModal({
  open,
  taskId,
  onClose,
  onSuccess,
}: DuplicateTaskModalProps) {
  const { t } = useI18n();
  const [studentName, setStudentName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!studentName.trim()) {
      setError(t("requiredField"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/tasks/${taskId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_name: studentName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || t("saveError"));
        return;
      }

      setStudentName("");
      onSuccess();
      onClose();
    } catch {
      setError(t("saveError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} title={t("duplicateTask")} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t("newStudentName")}
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          error={error}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? t("duplicating") : t("duplicate")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
