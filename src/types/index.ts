import type { TaskStatus } from "./database";

export type { TaskStatus };
export type TaskAnswers = Record<string, string | boolean | string[]>;

export interface Task {
  id: string;
  slug: string;
  title: string;
  student_name: string;
  html_content: string;
  status: TaskStatus;
  teacher_id: string;
  group_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskWithAnswers extends Task {
  answers: TaskAnswers;
  answers_updated_at: string | null;
}

export interface TaskListItem {
  id: string;
  slug: string;
  title: string;
  student_name: string;
  status: TaskStatus;
  group_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskMemberInput {
  student_name?: string;
  slug?: string;
}

export interface CreateTaskInput {
  title: string;
  html_content: string;
  student_name?: string;
  /** When true, create multiple copies linked by group_id. */
  is_group?: boolean;
  members?: CreateTaskMemberInput[];
}

export interface DuplicateTaskInput {
  student_name: string;
}

export interface SaveAnswersInput {
  answers: TaskAnswers;
}
