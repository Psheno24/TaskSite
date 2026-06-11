import {
  ApiError,
  handleRouteError,
  validateSlug,
} from "@/lib/api-utils";
import { createServiceClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function PATCH(_request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;

    if (!validateSlug(slug)) {
      throw new ApiError(400, "Invalid slug");
    }

    const supabase = createServiceClient();

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id, status")
      .eq("slug", slug)
      .single();

    if (taskError || !task) {
      throw new ApiError(404, "Task not found");
    }

    if (task.status === "completed") {
      return Response.json({ success: true, status: "completed" });
    }

    const { error } = await supabase
      .from("tasks")
      .update({ status: "completed" })
      .eq("id", task.id);

    if (error) {
      throw new ApiError(500, "Failed to complete task");
    }

    return Response.json({ success: true, status: "completed" });
  } catch (error) {
    return handleRouteError(error);
  }
}
