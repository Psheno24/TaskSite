import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "tasksite_session";

async function getTeacherSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) return null;

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret)
    );
    if (
      typeof payload.sub === "string" &&
      typeof payload.email === "string" &&
      payload.role === "teacher"
    ) {
      return true;
    }
  } catch {
    return null;
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const provider = (process.env.DATA_PROVIDER || "supabase").toLowerCase();
  const path = request.nextUrl.pathname;
  const isDashboard = path === "/dashboard" || path.startsWith("/dashboard/");
  const isLogin = path === "/login" || path.startsWith("/login/");

  if (provider === "postgres") {
    const isTeacher = Boolean(await getTeacherSession(request));

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

    return NextResponse.next();
  }

  const { updateSession } = await import("@/lib/supabase/middleware");
  return updateSession(request);
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*", "/login"],
};
