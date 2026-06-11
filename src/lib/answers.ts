import type { SupabaseClient } from "@supabase/supabase-js";
import { mergeAnswers } from "@/lib/utils";

interface SaveAnswersResult {
  answers: Record<string, unknown>;
  updated_at: string | null;
}

export async function saveTaskAnswers(
  supabase: SupabaseClient,
  taskId: string,
  incoming: Record<string, unknown>
): Promise<SaveAnswersResult> {
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { data: existingRow, error: fetchError } = await supabase
      .from("task_answers")
      .select("answers, updated_at")
      .eq("task_id", taskId)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      throw new Error(fetchError.message);
    }

    const existingAnswers =
      (existingRow?.answers as Record<string, unknown>) || {};
    const mergedAnswers = mergeAnswers(existingAnswers, incoming);

    const { data, error: upsertError } = await supabase
      .from("task_answers")
      .upsert(
        {
          task_id: taskId,
          answers: mergedAnswers,
        },
        { onConflict: "task_id" }
      )
      .select("answers, updated_at")
      .single();

    if (!upsertError && data) {
      return {
        answers: data.answers as Record<string, unknown>,
        updated_at: data.updated_at,
      };
    }

    if (attempt === maxRetries - 1 && upsertError) {
      throw new Error(upsertError.message);
    }
  }

  throw new Error("Failed to save answers");
}
