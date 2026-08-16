import { saveTaskAnswers as saveViaStore } from "@/lib/data/tasks";
import type { DataAccess } from "@/lib/data/types";

interface SaveAnswersResult {
  answers: Record<string, unknown>;
  updated_at: string | null;
}

export async function saveTaskAnswers(
  taskId: string,
  incoming: Record<string, unknown>,
  access: DataAccess = "user"
): Promise<SaveAnswersResult> {
  return saveViaStore(taskId, incoming, access);
}
