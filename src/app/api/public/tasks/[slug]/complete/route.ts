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

  if (task.status === "completed") {
    return NextResponse.json({ success: true, status: "completed" });
  }

  const { error } = await supabase
    .from("tasks")
    .update({ status: "completed" })
    .eq("id", task.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, status: "completed" });
}
