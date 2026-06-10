import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { TaskAnswers } from "@/types";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params;

  if (!slug || slug.length < 6) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, slug, title, student_name, html_content, status, updated_at")
    .eq("slug", slug)
    .single();

  if (taskError || !task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const { data: answersRow } = await supabase
    .from("task_answers")
    .select("answers, updated_at")
    .eq("task_id", task.id)
    .single();

  return NextResponse.json({
    ...task,
    answers: (answersRow?.answers as TaskAnswers) || {},
    answers_updated_at: answersRow?.updated_at || null,
  });
}
