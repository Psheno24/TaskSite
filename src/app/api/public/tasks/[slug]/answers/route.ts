import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getNextStatus } from "@/lib/utils";
import type { SaveAnswersInput } from "@/types";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { slug } = await params;

  if (!slug || slug.length < 6) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  const body = (await request.json()) as SaveAnswersInput;

  if (!body.answers || typeof body.answers !== "object") {
    return NextResponse.json({ error: "answers is required" }, { status: 400 });
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

  if (task.status === "completed") {
    return NextResponse.json(
      { error: "Task is already completed" },
      { status: 403 }
    );
  }

  const hasAnswers = Object.keys(body.answers).length > 0;
  const newStatus = getNextStatus(task.status, hasAnswers);

  const { error: answersError } = await supabase
    .from("task_answers")
    .upsert(
      {
        task_id: task.id,
        answers: body.answers,
      },
      { onConflict: "task_id" }
    );

  if (answersError) {
    return NextResponse.json({ error: answersError.message }, { status: 500 });
  }

  if (newStatus !== task.status) {
    await supabase
      .from("tasks")
      .update({ status: newStatus })
      .eq("id", task.id);
  }

  return NextResponse.json({ success: true, status: newStatus });
}
