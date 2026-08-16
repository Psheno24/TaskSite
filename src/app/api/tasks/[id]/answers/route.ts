import { saveTaskAnswers } from "@/lib/answers";
import {
  ApiError,
  handleRouteError,
  validateAnswersPayload,
} from "@/lib/api-utils";
import { requireTeacher } from "@/lib/auth";
import { getTaskStore } from "@/lib/data/tasks";
import { getNextStatus, isValidUuid } from "@/lib/utils";
import type { SaveAnswersInput } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const teacher = await requireTeacher();
    const { id } = await params;

    if (!isValidUuid(id)) {
      throw new ApiError(400, "Invalid task id");
    }

    const body = (await request.json()) as SaveAnswersInput;

    if (!validateAnswersPayload(body.answers)) {
      throw new ApiError(400, "Invalid answers payload");
    }

    const store = getTaskStore();
    const task = await store.getForTeacher(id, teacher.id);

    if (!task) {
      throw new ApiError(404, "Task not found");
    }

    const saved = await saveTaskAnswers(id, body.answers, "user");
    const hasAnswers = Object.keys(saved.answers).length > 0;
    const newStatus = getNextStatus(task.status, hasAnswers);

    if (newStatus !== task.status) {
      await store.updateStatus(id, newStatus, "user");
    }

    return Response.json({ success: true, status: newStatus });
  } catch (error) {
    return handleRouteError(error);
  }
}
