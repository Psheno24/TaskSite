import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function PATCH(_request: Request, { params }: RouteParams) {
  const { slug } = await params;

  if (!slug || slug.length < 6) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, status")
    .eq("slug", slug)
    .single();

  if (taskError || !task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (task.status !== "completed") {
    return NextResponse.json({ success: true, status: task.status });
  }

  const { data: answersRow } = await supabase
    .from("task_answers")
    .select("answers")
    .eq("task_id", task.id)
    .single();

  const hasAnswers =
    answersRow?.answers &&
    typeof answersRow.answers === "object" &&
    Object.keys(answersRow.answers).length > 0;

  const newStatus = hasAnswers ? "in_progress" : "not_started";

  const { error } = await supabase
    .from("tasks")
    .update({ status: newStatus })
    .eq("id", task.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, status: newStatus });
}
