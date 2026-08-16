import { getDataProvider } from "@/lib/provider";
import { postgresAuthStore, supabaseAuthStore } from "@/lib/data/auth";
import type { TeacherProfile } from "@/lib/data/types";

function getAuthStore() {
  return getDataProvider() === "postgres"
    ? postgresAuthStore
    : supabaseAuthStore;
}

export async function getTeacher(): Promise<TeacherProfile | null> {
  return getAuthStore().getTeacher();
}

export async function requireTeacher(): Promise<TeacherProfile> {
  const teacher = await getTeacher();
  if (!teacher) {
    throw new Error("Unauthorized");
  }
  return teacher;
}

export async function loginTeacher(
  email: string,
  password: string
): Promise<TeacherProfile | null> {
  return getAuthStore().login(email, password);
}

export async function logoutTeacher(): Promise<void> {
  return getAuthStore().logout();
}
