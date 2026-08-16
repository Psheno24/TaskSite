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

    if (task.status !== "completed") {
      return Response.json({ success: true, status: task.status });
    }

    const answersRow = await store.getAnswers(task.id, "service");
    const hasAnswers =
      answersRow?.answers &&
      typeof answersRow.answers === "object" &&
      Object.keys(answersRow.answers).length > 0;

    const newStatus = hasAnswers ? "in_progress" : "not_started";
    await store.updateStatus(task.id, newStatus, "service");

    return Response.json({ success: true, status: newStatus });
  } catch (error) {
    return handleRouteError(error);
  }
}
