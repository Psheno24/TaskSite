import { createClient } from "@/lib/supabase/server";

export async function getTeacher() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, email, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "teacher") {
    return null;
  }

  return { ...profile, authUser: user };
}

export async function requireTeacher() {
  const teacher = await getTeacher();
  if (!teacher) {
    throw new Error("Unauthorized");
  }
  return teacher;
}
