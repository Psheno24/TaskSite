import { NextResponse } from "next/server";
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
      return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
    }

    const body = (await request.json()) as DuplicateTaskInput;

    if (!body.student_name?.trim()) {
      return NextResponse.json(
        { error: "student_name is required" },
        { status: 400 }
      );
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
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
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
      return NextResponse.json(
        { error: taskError?.message || "Failed to duplicate task" },
        { status: 500 }
      );
    }

    const { error: answersError } = await supabase
      .from("task_answers")
      .insert({
        task_id: task.id,
        answers: {},
      });

    if (answersError) {
      await supabase.from("tasks").delete().eq("id", task.id);
      return NextResponse.json({ error: answersError.message }, { status: 500 });
    }

    return NextResponse.json(task, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
