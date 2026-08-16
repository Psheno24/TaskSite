import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Task, TaskListItem, TaskAnswers } from "@/types";
import type {
  DataAccess,
  PublicTaskView,
  TaskIdStatus,
  TaskStore,
} from "./types";

function mapTask(row: Record<string, unknown>): Task {
  return row as unknown as Task;
}

async function getClient(access: DataAccess = "user") {
  if (access === "service") {
    return createServiceClient();
  }
  return createClient();
}

export const supabaseTaskStore: TaskStore = {
  async listForTeacher(teacherId) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tasks")
      .select("id, slug, title, student_name, status, created_at, updated_at")
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []) as TaskListItem[];
  },

  async create(data) {
    const supabase = await createClient();
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .insert({
        slug: data.slug,
        title: data.title,
        student_name: data.student_name,
        html_content: data.html_content,
        teacher_id: data.teacher_id,
        status: "not_started",
      })
      .select()
      .single();

    if (taskError || !task) {
      throw new Error(taskError?.message || "Failed to create task");
    }

    const { error: answersError } = await supabase
      .from("task_answers")
      .insert({ task_id: task.id, answers: {} });

    if (answersError) {
      await supabase.from("tasks").delete().eq("id", task.id);
      throw new Error(answersError.message);
    }

    return mapTask(task);
  },

  async getForTeacher(id, teacherId) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", id)
      .eq("teacher_id", teacherId)
      .single();

    if (error || !data) return null;
    return mapTask(data);
  },

  async getTitleHtmlForTeacher(id, teacherId) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tasks")
      .select("title, html_content")
      .eq("id", id)
      .eq("teacher_id", teacherId)
      .single();

    if (error || !data) return null;
    return data;
  },

  async deleteForTeacher(id, teacherId) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id)
      .eq("teacher_id", teacherId)
      .select("id");

    if (error) throw new Error(error.message);
    return Boolean(data && data.length > 0);
  },

  async getAnswers(taskId, access = "user") {
    const supabase = await getClient(access);
    const { data } = await supabase
      .from("task_answers")
      .select("answers, updated_at")
      .eq("task_id", taskId)
      .single();

    if (!data) return null;
    return {
      answers: (data.answers as Record<string, unknown>) || {},
      updated_at: data.updated_at,
    };
  },

  async upsertAnswers(taskId, answers, access = "user") {
    const supabase = await getClient(access);
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const { data, error } = await supabase
        .from("task_answers")
        .upsert({ task_id: taskId, answers }, { onConflict: "task_id" })
        .select("answers, updated_at")
        .single();

      if (!error && data) {
        return {
          answers: data.answers as Record<string, unknown>,
          updated_at: data.updated_at,
        };
      }

      if (attempt === maxRetries - 1 && error) {
        throw new Error(error.message);
      }
    }

    throw new Error("Failed to save answers");
  },

  async updateStatus(taskId, status, access = "user") {
    const supabase = await getClient(access);
    const { error } = await supabase
      .from("tasks")
      .update({ status })
      .eq("id", taskId);

    if (error) throw new Error(error.message);
  },

  async getPublicBySlug(slug) {
    const supabase = createServiceClient();
    const { data: task, error } = await supabase
      .from("tasks")
      .select(
        "slug, title, student_name, html_content, status, updated_at, task_answers(answers, updated_at)"
      )
      .eq("slug", slug)
      .single();

    if (error || !task) return null;

    const answersRow = Array.isArray(task.task_answers)
      ? task.task_answers[0]
      : task.task_answers;

    return {
      slug: task.slug,
      title: task.title,
      student_name: task.student_name,
      html_content: task.html_content,
      status: task.status,
      updated_at: task.updated_at,
      answers: (answersRow?.answers as TaskAnswers) || {},
      answers_updated_at: answersRow?.updated_at || null,
    } satisfies PublicTaskView;
  },

  async getIdStatusBySlug(slug) {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("tasks")
      .select("id, status")
      .eq("slug", slug)
      .single();

    if (error || !data) return null;
    return data as TaskIdStatus;
  },

  async getTitleBySlug(slug) {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("tasks")
      .select("title")
      .eq("slug", slug)
      .single();

    return data?.title ?? null;
  },
};
