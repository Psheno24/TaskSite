import { ApiError, handleRouteError } from "@/lib/api-utils";
import { requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createTaskSlug, isValidUuid } from "@/lib/utils";
import type { DuplicateTaskInput } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!isValidUuid(id)) {
      throw new ApiError(400, "Invalid task id");
    }

    const body = (await request.json()) as DuplicateTaskInput;

    if (!body.student_name?.trim()) {
      throw new ApiError(400, "student_name is required");
    }

    const teacher = await requireTeacher();
    const supabase = await createClient();

    const { data: original, error: fetchError } = await supabase
      .from("tasks")
      .select("title, html_content")
      .eq("id", id)
      .eq("teacher_id", teacher.id)
      .single();

    if (fetchError || !original) {
      throw new ApiError(404, "Task not found");
    }

    const slug = createTaskSlug();

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .insert({
        slug,
        title: original.title,
        student_name: body.student_name.trim(),
        html_content: original.html_content,
        teacher_id: teacher.id,
        status: "not_started",
      })
      .select()
      .single();

    if (taskError || !task) {
      throw new ApiError(500, taskError?.message || "Failed to duplicate task");
    }

    const { error: answersError } = await supabase
      .from("task_answers")
      .insert({
        task_id: task.id,
        answers: {},
      });

    if (answersError) {
      await supabase.from("tasks").delete().eq("id", task.id);
      throw new ApiError(500, answersError.message);
    }

    return Response.json(task, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
