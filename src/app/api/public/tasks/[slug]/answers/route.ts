import { saveTaskAnswers } from "@/lib/answers";
import {
  ApiError,
  handleRouteError,
  validateAnswersPayload,
  validateSlug,
} from "@/lib/api-utils";
import { createServiceClient } from "@/lib/supabase/server";
import { getNextStatus } from "@/lib/utils";
import type { SaveAnswersInput } from "@/types";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;

    if (!validateSlug(slug)) {
      throw new ApiError(400, "Invalid slug");
    }

    const body = (await request.json()) as SaveAnswersInput;

    if (!validateAnswersPayload(body.answers)) {
      throw new ApiError(400, "Invalid answers payload");
    }

    const supabase = createServiceClient();

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id, status")
      .eq("slug", slug)
      .single();

    if (taskError || !task) {
      throw new ApiError(404, "Task not found");
    }

    if (task.status === "completed") {
      throw new ApiError(403, "Task is already completed");
    }

    const saved = await saveTaskAnswers(supabase, task.id, body.answers);
    const hasAnswers = Object.keys(saved.answers).length > 0;
    const newStatus = getNextStatus(task.status, hasAnswers);

    if (newStatus !== task.status) {
      const { error: statusError } = await supabase
        .from("tasks")
        .update({ status: newStatus })
        .eq("id", task.id);

      if (statusError) {
        throw new ApiError(500, "Failed to update task status");
      }
    }

    return Response.json({ success: true, status: newStatus });
  } catch (error) {
    return handleRouteError(error);
  }
}
