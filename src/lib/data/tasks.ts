import { getDataProvider } from "@/lib/provider";
import { postgresTaskStore } from "./tasks.postgres";
import { supabaseTaskStore } from "./tasks.supabase";
import type { DataAccess, TaskStore } from "./types";

export function getTaskStore(): TaskStore {
  return getDataProvider() === "postgres"
    ? postgresTaskStore
    : supabaseTaskStore;
}

export async function saveTaskAnswers(
  taskId: string,
  answers: Record<string, unknown>,
  access: DataAccess = "user"
) {
  return getTaskStore().upsertAnswers(taskId, answers, access);
}
