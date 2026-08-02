import {
  ApiError,
  handleRouteError,
  validateSlug,
} from "@/lib/api-utils";
import { createServiceClient } from "@/lib/supabase/server";
import type { TaskAnswers } from "@/types";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;

    if (!validateSlug(slug)) {
      throw new ApiError(400, "Invalid slug");
    }

    const supabase = createServiceClient();

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select(
        "slug, title, student_name, html_content, status, updated_at, task_answers(answers, updated_at)"
      )
      .eq("slug", slug)
      .single();

    if (taskError || !task) {
      throw new ApiError(404, "Task not found");
    }

    const answersRow = Array.isArray(task.task_answers)
      ? task.task_answers[0]
      : task.task_answers;

    return Response.json({
      slug: task.slug,
      title: task.title,
      student_name: task.student_name,
      html_content: task.html_content,
      status: task.status,
      updated_at: task.updated_at,
      answers: (answersRow?.answers as TaskAnswers) || {},
      answers_updated_at: answersRow?.updated_at || null,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
