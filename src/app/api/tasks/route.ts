import { ApiError, handleRouteError, MAX_HTML_SIZE } from "@/lib/api-utils";
import { requireTeacher } from "@/lib/auth";
import { getTaskStore } from "@/lib/data/tasks";
import { prepareTaskHtml } from "@/lib/prepare-task-html";
import { createTaskSlug } from "@/lib/utils";
import type { CreateTaskInput } from "@/types";

export async function GET() {
  try {
    const teacher = await requireTeacher();
    const tasks = await getTaskStore().listForTeacher(teacher.id);
    return Response.json(tasks);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const teacher = await requireTeacher();
    const body = (await request.json()) as CreateTaskInput;

    if (!body.title?.trim() || !body.student_name?.trim() || !body.html_content?.trim()) {
      throw new ApiError(400, "title, student_name and html_content are required");
    }

    if (body.html_content.length > MAX_HTML_SIZE) {
      throw new ApiError(400, "HTML content exceeds maximum size");
    }

    const { html: preparedHtml, warnings } = prepareTaskHtml(body.html_content);
    const slug = createTaskSlug();

    const task = await getTaskStore().create({
      slug,
      title: body.title.trim(),
      student_name: body.student_name.trim(),
      html_content: preparedHtml,
      teacher_id: teacher.id,
    });

    return Response.json({ ...task, html_warnings: warnings }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
