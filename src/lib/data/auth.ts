import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { verifyPassword } from "@/lib/db/password";
import {
  clearSessionCookie,
  readSessionFromCookies,
  setSessionCookie,
} from "@/lib/db/session";
import { users } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";
import type { AuthStore, TeacherProfile } from "./types";

export const supabaseAuthStore: AuthStore = {
  async getTeacher() {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return null;

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("id, email, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "teacher") {
      return null;
    }

    return profile as TeacherProfile;
  },

  async login(email, password) {
    const supabase = await createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) return null;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: profile } = await supabase
      .from("users")
      .select("id, email, role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "teacher") {
      await supabase.auth.signOut();
      return null;
    }

    return profile as TeacherProfile;
  },

  async logout() {
    const supabase = await createClient();
    await supabase.auth.signOut();
  },
};

export const postgresAuthStore: AuthStore = {
  async getTeacher() {
    const session = await readSessionFromCookies();
    if (!session || session.role !== "teacher") return null;

    return {
      id: session.sub,
      email: session.email,
      role: session.role,
    };
  },

  async login(email, password) {
    const db = getDb();
    const normalized = email.trim().toLowerCase();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalized))
      .limit(1);

    if (!user || user.role !== "teacher") return null;

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return null;

    const profile: TeacherProfile = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    await setSessionCookie({
      sub: profile.id,
      email: profile.email,
      role: profile.role,
    });

    return profile;
  },

  async logout() {
    await clearSessionCookie();
  },
};
