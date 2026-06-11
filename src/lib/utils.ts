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

export function formatDate(dateString: string): string {
  const d = new Date(dateString);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear()).slice(-2);
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year} (${hours}:${minutes})`;
}

export function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

export function mergeAnswers(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  return { ...existing, ...incoming };
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
