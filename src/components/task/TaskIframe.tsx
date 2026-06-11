"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { injectBridgeIntoHtml } from "@/lib/bridge-script";
import type { TaskAnswers } from "@/types";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface TaskIframeProps {
  htmlContent: string;
  initialAnswers: TaskAnswers;
  onAnswersChange: (answers: TaskAnswers) => Promise<void>;
  readOnly?: boolean;
  saveStatusLabel?: {
    saving: string;
    saved: string;
    error: string;
  };
  showSaveIndicator?: boolean;
  fullscreen?: boolean;
}

export function TaskIframe({
  htmlContent,
  initialAnswers,
  onAnswersChange,
  readOnly = false,
  saveStatusLabel,
  showSaveIndicator = true,
  fullscreen = false,
}: TaskIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const answersRef = useRef<TaskAnswers>(initialAnswers);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const srcDoc = injectBridgeIntoHtml(htmlContent);

  const sendToIframe = useCallback((message: object) => {
    iframeRef.current?.contentWindow?.postMessage(message, "*");
  }, []);

  useEffect(() => {
    answersRef.current = initialAnswers;
    if (isReady) {
      sendToIframe({ type: "RESTORE_ANSWERS", answers: initialAnswers });
      sendToIframe({ type: "SET_READONLY", readonly: readOnly });
    }
  }, [initialAnswers, isReady, readOnly, sendToIframe]);

  useEffect(() => {
    const flushSave = () => {
      sendToIframe({ type: "REQUEST_ANSWERS" });
    };

    window.addEventListener("pagehide", flushSave);
    window.addEventListener("beforeunload", flushSave);

    const handleMessage = async (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "TASK_READY") {
        setIsReady(true);
        sendToIframe({ type: "RESTORE_ANSWERS", answers: answersRef.current });
        sendToIframe({ type: "SET_READONLY", readonly: readOnly });
        return;
      }

      if (data.type === "ANSWERS_CHANGED" && !readOnly) {
        const answers = data.answers as TaskAnswers;
        answersRef.current = answers;

        setSaveStatus("saving");
        try {
          await onAnswersChange(answers);
          setSaveStatus("saved");
          if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
        } catch {
          setSaveStatus("error");
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("pagehide", flushSave);
      window.removeEventListener("beforeunload", flushSave);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [onAnswersChange, readOnly, sendToIframe]);

  return (
    <div
      className={
        fullscreen
          ? "relative flex h-full min-h-0 flex-1 flex-col"
          : "space-y-2"
      }
    >
      {showSaveIndicator && saveStatusLabel && saveStatus !== "idle" && (
        <div
          className={
            fullscreen
              ? "absolute right-3 top-3 z-10 rounded-md bg-white/90 px-2 py-1 text-xs shadow-sm"
              : "text-sm text-gray-500"
          }
        >
          {saveStatus === "saving" && saveStatusLabel.saving}
          {saveStatus === "saved" && (
            <span className="text-green-600">{saveStatusLabel.saved}</span>
          )}
          {saveStatus === "error" && (
            <span className="text-red-600">{saveStatusLabel.error}</span>
          )}
        </div>
      )}
      <iframe
        ref={iframeRef}
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-forms allow-same-origin"
        className={
          fullscreen
            ? "h-full w-full flex-1 border-0 bg-white"
            : "w-full min-h-[500px] rounded-md border border-gray-200 bg-white"
        }
        title="Task"
      />
    </div>
  );
}
