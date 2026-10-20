import {
  ApiError,
  handleRouteError,
  MAX_GROUP_MEMBERS,
  MAX_HTML_SIZE,
  MIN_GROUP_MEMBERS,
  validateSlug,
} from "@/lib/api-utils";
import { requireTeacher } from "@/lib/auth";
import { getTaskStore } from "@/lib/data/tasks";
import type { CreateTaskData } from "@/lib/data/types";
import { prepareTaskHtml } from "@/lib/prepare-task-html";
import { createTaskSlug } from "@/lib/utils";
import type { CreateTaskInput } from "@/types";
import { randomUUID } from "crypto";

function resolveMemberName(raw: string | undefined, index: number): string {
  const trimmed = raw?.trim();
  return trimmed || String(index + 1);
}

function resolveMemberSlug(raw: string | undefined, used: Set<string>): string {
  const candidate = raw?.trim();
  if (candidate) {
    if (!validateSlug(candidate)) {
      throw new ApiError(400, "Invalid member slug");
    }
    if (used.has(candidate)) {
      throw new ApiError(400, "Duplicate member slug");
    }
    used.add(candidate);
    return candidate;
  }

  let slug = createTaskSlug();
  while (used.has(slug)) {
    slug = createTaskSlug();
  }
  used.add(slug);
  return slug;
}

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

    if (!body.title?.trim() || !body.html_content?.trim()) {
      throw new ApiError(400, "title and html_content are required");
    }

    if (body.html_content.length > MAX_HTML_SIZE) {
      throw new ApiError(400, "HTML content exceeds maximum size");
    }

    const { html: preparedHtml, warnings } = prepareTaskHtml(body.html_content);
    const store = getTaskStore();
    const title = body.title.trim();

    if (body.is_group) {
      const members = body.members;
      if (
        !Array.isArray(members) ||
        members.length < MIN_GROUP_MEMBERS ||
        members.length > MAX_GROUP_MEMBERS
      ) {
        throw new ApiError(
          400,
          `Group must contain between ${MIN_GROUP_MEMBERS} and ${MAX_GROUP_MEMBERS} members`
        );
      }

      const groupId = randomUUID();
      const usedSlugs = new Set<string>();
      const items: CreateTaskData[] = members.map((member, index) => ({
        slug: resolveMemberSlug(member?.slug, usedSlugs),
        title,
        student_name: resolveMemberName(member?.student_name, index),
        html_content: preparedHtml,
        teacher_id: teacher.id,
        group_id: groupId,
      }));

      const tasks = await store.createMany(items);

      return Response.json(
        { tasks, group_id: groupId, html_warnings: warnings },
        { status: 201 }
      );
    }

    if (!body.student_name?.trim()) {
      throw new ApiError(400, "title, student_name and html_content are required");
    }

    const task = await store.create({
      slug: createTaskSlug(),
      title,
      student_name: body.student_name.trim(),
      html_content: preparedHtml,
      teacher_id: teacher.id,
    });

    return Response.json({ ...task, html_warnings: warnings }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
