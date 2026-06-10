import { NextResponse } from "next/server";
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(tasks);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const teacher = await requireTeacher();
    const body = (await request.json()) as CreateTaskInput;

    if (!body.title?.trim() || !body.student_name?.trim() || !body.html_content?.trim()) {
      return NextResponse.json(
        { error: "title, student_name and html_content are required" },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: taskError?.message || "Failed to create task" },
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
