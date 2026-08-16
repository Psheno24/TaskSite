import {
  ApiError,
  handleRouteError,
  validateSlug,
} from "@/lib/api-utils";
import { getTaskStore } from "@/lib/data/tasks";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function PATCH(_request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;

    if (!validateSlug(slug)) {
      throw new ApiError(400, "Invalid slug");
    }

    const store = getTaskStore();
    const task = await store.getIdStatusBySlug(slug);

    if (!task) {
      throw new ApiError(404, "Task not found");
    }

    if (task.status === "completed") {
      return Response.json({ success: true, status: "completed" });
    }

    await store.updateStatus(task.id, "completed", "service");

    return Response.json({ success: true, status: "completed" });
  } catch (error) {
    return handleRouteError(error);
  }
}
