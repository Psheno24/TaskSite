import { saveTaskAnswers } from "@/lib/answers";
import {
  ApiError,
  handleRouteError,
  validateAnswersPayload,
  validateSlug,
} from "@/lib/api-utils";
import { getTaskStore } from "@/lib/data/tasks";
import { getNextStatus } from "@/lib/utils";
import type { SaveAnswersInput } from "@/types";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;

    if (!validateSlug(slug)) {
      throw new ApiError(400, "Invalid slug");
    }

    const body = (await request.json()) as SaveAnswersInput;

    if (!validateAnswersPayload(body.answers)) {
      throw new ApiError(400, "Invalid answers payload");
    }

    const store = getTaskStore();
    const task = await store.getIdStatusBySlug(slug);

    if (!task) {
      throw new ApiError(404, "Task not found");
    }

    if (task.status === "completed") {
      throw new ApiError(403, "Task is already completed");
    }

    const saved = await saveTaskAnswers(task.id, body.answers, "service");
    const hasAnswers = Object.keys(saved.answers).length > 0;
    const newStatus = getNextStatus(task.status, hasAnswers);

    if (newStatus !== task.status) {
      await store.updateStatus(task.id, newStatus, "service");
    }

    return Response.json({ success: true, status: newStatus });
  } catch (error) {
    return handleRouteError(error);
  }
}
