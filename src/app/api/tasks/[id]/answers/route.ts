import { saveTaskAnswers } from "@/lib/answers";
import {
  ApiError,
  handleRouteError,
  validateAnswersPayload,
} from "@/lib/api-utils";
import { requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getNextStatus, isValidUuid } from "@/lib/utils";
import type { SaveAnswersInput } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const teacher = await requireTeacher();
    const { id } = await params;

    if (!isValidUuid(id)) {
      throw new ApiError(400, "Invalid task id");
    }

    const body = (await request.json()) as SaveAnswersInput;

    if (!validateAnswersPayload(body.answers)) {
      throw new ApiError(400, "Invalid answers payload");
    }

    const supabase = await createClient();

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id, status")
      .eq("id", id)
      .eq("teacher_id", teacher.id)
      .single();

    if (taskError || !task) {
      throw new ApiError(404, "Task not found");
    }

    const saved = await saveTaskAnswers(supabase, id, body.answers);
    const hasAnswers = Object.keys(saved.answers).length > 0;
    const newStatus = getNextStatus(task.status, hasAnswers);

    if (newStatus !== task.status) {
      const { error: statusError } = await supabase
        .from("tasks")
        .update({ status: newStatus })
        .eq("id", id);

      if (statusError) {
        throw new ApiError(500, "Failed to update task status");
      }
    }

    return Response.json({ success: true, status: newStatus });
  } catch (error) {
    return handleRouteError(error);
  }
}
