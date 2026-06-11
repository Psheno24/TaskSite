import { ApiError, handleRouteError } from "@/lib/api-utils";
import { requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isValidUuid } from "@/lib/utils";
import type { TaskAnswers } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!isValidUuid(id)) {
      throw new ApiError(400, "Invalid task id");
    }

    const teacher = await requireTeacher();
    const supabase = await createClient();

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", id)
      .eq("teacher_id", teacher.id)
      .single();

    if (taskError || !task) {
      throw new ApiError(404, "Task not found");
    }

    const { data: answersRow } = await supabase
      .from("task_answers")
      .select("answers, updated_at")
      .eq("task_id", id)
      .single();

    return Response.json({
      ...task,
      answers: (answersRow?.answers as TaskAnswers) || {},
      answers_updated_at: answersRow?.updated_at || null,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!isValidUuid(id)) {
      throw new ApiError(400, "Invalid task id");
    }

    const teacher = await requireTeacher();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id)
      .eq("teacher_id", teacher.id)
      .select("id");

    if (error) {
      throw new ApiError(500, error.message);
    }

    if (!data || data.length === 0) {
      throw new ApiError(404, "Task not found");
    }

    return Response.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
