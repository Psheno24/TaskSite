import { NextResponse } from "next/server";
import { logoutTeacher } from "@/lib/auth";

export async function POST() {
  await logoutTeacher();
  return NextResponse.json({ success: true });
}
