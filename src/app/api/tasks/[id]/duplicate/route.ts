import { ApiError, handleRouteError } from "@/lib/api-utils";
import { requireTeacher } from "@/lib/auth";
import { getTaskStore } from "@/lib/data/tasks";
import { createTaskSlug, isValidUuid } from "@/lib/utils";
import type { DuplicateTaskInput } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!isValidUuid(id)) {
      throw new ApiError(400, "Invalid task id");
    }

    const body = (await request.json()) as DuplicateTaskInput;

    if (!body.student_name?.trim()) {
      throw new ApiError(400, "student_name is required");
    }

    const teacher = await requireTeacher();
    const store = getTaskStore();
    const original = await store.getTitleHtmlForTeacher(id, teacher.id);

    if (!original) {
      throw new ApiError(404, "Task not found");
    }

    const task = await store.create({
      slug: createTaskSlug(),
      title: original.title,
      student_name: body.student_name.trim(),
      html_content: original.html_content,
      teacher_id: teacher.id,
    });

    return Response.json(task, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
