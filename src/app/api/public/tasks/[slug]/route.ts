import {
  ApiError,
  handleRouteError,
  validateSlug,
} from "@/lib/api-utils";
import { getTaskStore } from "@/lib/data/tasks";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;

    if (!validateSlug(slug)) {
      throw new ApiError(400, "Invalid slug");
    }

    const task = await getTaskStore().getPublicBySlug(slug);

    if (!task) {
      throw new ApiError(404, "Task not found");
    }

    return Response.json(task);
  } catch (error) {
    return handleRouteError(error);
  }
}
