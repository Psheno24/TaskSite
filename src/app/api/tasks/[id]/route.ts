import { ApiError, handleRouteError } from "@/lib/api-utils";
import { requireTeacher } from "@/lib/auth";
import { getTaskStore } from "@/lib/data/tasks";
import { isValidUuid } from "@/lib/utils";
import type { TaskAnswers } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!isValidUuid(id)) {
      throw new ApiError(400, "Invalid task id");
    }

    const teacher = await requireTeacher();
    const store = getTaskStore();
    const task = await store.getForTeacher(id, teacher.id);

    if (!task) {
      throw new ApiError(404, "Task not found");
    }

    const answersRow = await store.getAnswers(id, "user");

    return Response.json({
      ...task,
      answers: (answersRow?.answers as TaskAnswers) || {},
      answers_updated_at: answersRow?.updated_at || null,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!isValidUuid(id)) {
      throw new ApiError(400, "Invalid task id");
    }

    const teacher = await requireTeacher();
    const deleted = await getTaskStore().deleteForTeacher(id, teacher.id);

    if (!deleted) {
      throw new ApiError(404, "Task not found");
    }

    return Response.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
