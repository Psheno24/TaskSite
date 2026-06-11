import { ApiError, handleRouteError, MAX_HTML_SIZE } from "@/lib/api-utils";
import { requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createTaskSlug } from "@/lib/utils";
import type { CreateTaskInput } from "@/types";

export async function GET() {
  try {
    const teacher = await requireTeacher();
    const supabase = await createClient();

    const { data: tasks, error } = await supabase
      .from("tasks")
      .select("id, slug, title, student_name, status, created_at, updated_at")
      .eq("teacher_id", teacher.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw new ApiError(500, error.message);
    }

    return Response.json(tasks);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const teacher = await requireTeacher();
    const body = (await request.json()) as CreateTaskInput;

    if (!body.title?.trim() || !body.student_name?.trim() || !body.html_content?.trim()) {
      throw new ApiError(400, "title, student_name and html_content are required");
    }

    if (body.html_content.length > MAX_HTML_SIZE) {
      throw new ApiError(400, "HTML content exceeds maximum size");
    }

    const supabase = await createClient();
    const slug = createTaskSlug();

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .insert({
        slug,
        title: body.title.trim(),
        student_name: body.student_name.trim(),
        html_content: body.html_content,
        teacher_id: teacher.id,
        status: "not_started",
      })
      .select()
      .single();

    if (taskError || !task) {
      throw new ApiError(500, taskError?.message || "Failed to create task");
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
