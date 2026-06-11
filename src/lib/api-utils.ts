import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export function handleRouteError(error: unknown) {
  if (error instanceof ApiError) {
    return jsonError(error.status, error.message);
  }
  if (error instanceof Error && error.message === "Unauthorized") {
    return jsonError(401, "Unauthorized");
  }
  console.error(error);
  return jsonError(500, "Internal server error");
}

export const MAX_HTML_SIZE = 2 * 1024 * 1024; // 2 MB
export const MAX_ANSWERS_JSON_SIZE = 512 * 1024; // 512 KB

export function validateSlug(slug: string): boolean {
  return /^[0-9a-z]{12}$/.test(slug);
}

export function validateAnswersPayload(answers: unknown): answers is Record<string, unknown> {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return false;
  }
  const size = JSON.stringify(answers).length;
  return size <= MAX_ANSWERS_JSON_SIZE;
}
