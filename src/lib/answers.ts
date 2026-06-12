import type { SupabaseClient } from "@supabase/supabase-js";

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
    const { data, error: upsertError } = await supabase
      .from("task_answers")
      .upsert(
        {
          task_id: taskId,
          answers: incoming,
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
