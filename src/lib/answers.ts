import { getTaskStore, saveTaskAnswers as saveViaStore } from "@/lib/data/tasks";
import type { DataAccess } from "@/lib/data/types";
import { mergeAnswers } from "@/lib/utils";

interface SaveAnswersResult {
  answers: Record<string, unknown>;
  updated_at: string | null;
}

export async function saveTaskAnswers(
  taskId: string,
  incoming: Record<string, unknown>,
  access: DataAccess = "user"
): Promise<SaveAnswersResult> {
  const existing = await getTaskStore().getAnswers(taskId, access);
  const merged = mergeAnswers(existing?.answers || {}, incoming);
  // Allow intentional clears: empty-string values remove the key.
  Object.keys(incoming).forEach((key) => {
    const value = incoming[key];
    if (value === "" || value === null) {
      delete merged[key];
    }
  });
  return saveViaStore(taskId, merged, access);
}
