import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/db/session-token";
import { getDataProvider } from "@/lib/provider";
import { updateSession as updateSupabaseSession } from "@/lib/supabase/middleware";

async function updatePostgresSession(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  const isTeacher = session?.role === "teacher";

  const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");
  const isLogin = request.nextUrl.pathname.startsWith("/login");

  if (isDashboard && !isTeacher) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (isLogin && isTeacher) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}

export async function updateSession(request: NextRequest) {
  if (getDataProvider() === "postgres") {
    return updatePostgresSession(request);
  }
  return updateSupabaseSession(request);
}
