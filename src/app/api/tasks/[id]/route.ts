import { NextResponse } from "next/server";
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
      return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
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
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const { data: answersRow } = await supabase
      .from("task_answers")
      .select("answers, updated_at")
      .eq("task_id", id)
      .single();

    return NextResponse.json({
      ...task,
      answers: (answersRow?.answers as TaskAnswers) || {},
      answers_updated_at: answersRow?.updated_at || null,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
    }

    const teacher = await requireTeacher();
    const supabase = await createClient();

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id)
      .eq("teacher_id", teacher.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
