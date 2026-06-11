import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getNextStatus, isValidUuid, mergeAnswers } from "@/lib/utils";
import type { SaveAnswersInput } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
    }

    const body = (await request.json()) as SaveAnswersInput;

    if (!body.answers || typeof body.answers !== "object") {
      return NextResponse.json({ error: "answers is required" }, { status: 400 });
    }

    const teacher = await requireTeacher();
    const supabase = await createClient();

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id, status")
      .eq("id", id)
      .eq("teacher_id", teacher.id)
      .single();

    if (taskError || !task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const { data: existingRow } = await supabase
      .from("task_answers")
      .select("answers")
      .eq("task_id", id)
      .single();

    const existingAnswers =
      (existingRow?.answers as Record<string, unknown>) || {};
    const mergedAnswers = mergeAnswers(existingAnswers, body.answers);

    const hasAnswers = Object.keys(mergedAnswers).length > 0;
    const newStatus = getNextStatus(task.status, hasAnswers);

    const { error: answersError } = await supabase
      .from("task_answers")
      .upsert(
        {
          task_id: id,
          answers: mergedAnswers,
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
        .eq("id", id);
    }

    return NextResponse.json({ success: true, status: newStatus });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
