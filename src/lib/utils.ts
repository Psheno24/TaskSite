import { customAlphabet } from "nanoid";
import type { TaskStatus } from "@/types/database";

const generateSlug = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyz",
  12
);

export function createTaskSlug(): string {
  return generateSlug();
}

export function getTaskUrl(slug: string): string {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/task/${slug}`;
}

export function formatDate(dateString: string, locale: string): string {
  return new Date(dateString).toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

export function getNextStatus(
  current: TaskStatus,
  hasAnswers: boolean
): TaskStatus {
  if (current === "completed") return "completed";
  if (hasAnswers) return "in_progress";
  return current;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
