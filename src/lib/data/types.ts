import type { Task, TaskListItem, TaskStatus, TaskAnswers } from "@/types";

export type TeacherProfile = {
  id: string;
  email: string;
  role: string;
};

export type CreateTaskData = {
  slug: string;
  title: string;
  student_name: string;
  html_content: string;
  teacher_id: string;
};

export type PublicTaskView = {
  slug: string;
  title: string;
  student_name: string;
  html_content: string;
  status: TaskStatus;
  updated_at: string;
  answers: TaskAnswers;
  answers_updated_at: string | null;
};

export type TaskAnswersRow = {
  answers: Record<string, unknown>;
  updated_at: string | null;
};

export type TaskIdStatus = {
  id: string;
  status: TaskStatus;
};

/** `user` = teacher cookie/RLS; `service` = public student path (bypass RLS on Supabase). */
export type DataAccess = "user" | "service";

export interface TaskStore {
  listForTeacher(teacherId: string): Promise<TaskListItem[]>;
  create(data: CreateTaskData): Promise<Task>;
  getForTeacher(id: string, teacherId: string): Promise<Task | null>;
  getTitleHtmlForTeacher(
    id: string,
    teacherId: string
  ): Promise<{ title: string; html_content: string } | null>;
  deleteForTeacher(id: string, teacherId: string): Promise<boolean>;
  getAnswers(taskId: string, access?: DataAccess): Promise<TaskAnswersRow | null>;
  upsertAnswers(
    taskId: string,
    answers: Record<string, unknown>,
    access?: DataAccess
  ): Promise<TaskAnswersRow>;
  updateStatus(
    taskId: string,
    status: TaskStatus,
    access?: DataAccess
  ): Promise<void>;
  getPublicBySlug(slug: string): Promise<PublicTaskView | null>;
  getIdStatusBySlug(slug: string): Promise<TaskIdStatus | null>;
  getTitleBySlug(slug: string): Promise<string | null>;
}

export interface AuthStore {
  getTeacher(): Promise<TeacherProfile | null>;
  login(email: string, password: string): Promise<TeacherProfile | null>;
  logout(): Promise<void>;
}
