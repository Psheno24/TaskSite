import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { taskAnswers, tasks } from "@/lib/db/schema";
import type { Task, TaskListItem, TaskAnswers } from "@/types";
import type {
  CreateTaskData,
  PublicTaskView,
  TaskAnswersRow,
  TaskIdStatus,
  TaskStore,
} from "./types";

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function mapTask(row: typeof tasks.$inferSelect): Task {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    student_name: row.studentName,
    html_content: row.htmlContent,
    status: row.status,
    teacher_id: row.teacherId,
    created_at: toIso(row.createdAt),
    updated_at: toIso(row.updatedAt),
  };
}

function mapListItem(row: typeof tasks.$inferSelect): TaskListItem {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    student_name: row.studentName,
    status: row.status,
    created_at: toIso(row.createdAt),
    updated_at: toIso(row.updatedAt),
  };
}

export const postgresTaskStore: TaskStore = {
  async listForTeacher(teacherId) {
    const db = getDb();
    const rows = await db
      .select()
      .from(tasks)
      .where(eq(tasks.teacherId, teacherId))
      .orderBy(desc(tasks.createdAt));

    return rows.map(mapListItem);
  },

  async create(data: CreateTaskData) {
    const db = getDb();

    const inserted = await db.transaction(async (tx) => {
      const [task] = await tx
        .insert(tasks)
        .values({
          slug: data.slug,
          title: data.title,
          studentName: data.student_name,
          htmlContent: data.html_content,
          teacherId: data.teacher_id,
          status: "not_started",
        })
        .returning();

      if (!task) {
        throw new Error("Failed to create task");
      }

      await tx.insert(taskAnswers).values({
        taskId: task.id,
        answers: {},
      });

      return task;
    });

    return mapTask(inserted);
  },

  async getForTeacher(id, teacherId) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.teacherId, teacherId)))
      .limit(1);

    return row ? mapTask(row) : null;
  },

  async getTitleHtmlForTeacher(id, teacherId) {
    const db = getDb();
    const [row] = await db
      .select({
        title: tasks.title,
        htmlContent: tasks.htmlContent,
      })
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.teacherId, teacherId)))
      .limit(1);

    if (!row) return null;
    return { title: row.title, html_content: row.htmlContent };
  },

  async deleteForTeacher(id, teacherId) {
    const db = getDb();
    const deleted = await db
      .delete(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.teacherId, teacherId)))
      .returning({ id: tasks.id });

    return deleted.length > 0;
  },

  async getAnswers(taskId) {
    const db = getDb();
    const [row] = await db
      .select({
        answers: taskAnswers.answers,
        updatedAt: taskAnswers.updatedAt,
      })
      .from(taskAnswers)
      .where(eq(taskAnswers.taskId, taskId))
      .limit(1);

    if (!row) return null;
    return {
      answers: (row.answers as Record<string, unknown>) || {},
      updated_at: toIso(row.updatedAt),
    };
  },

  async upsertAnswers(taskId, answers) {
    const db = getDb();
    const now = new Date();

    const [row] = await db
      .insert(taskAnswers)
      .values({
        taskId,
        answers,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: taskAnswers.taskId,
        set: {
          answers,
          updatedAt: now,
        },
      })
      .returning({
        answers: taskAnswers.answers,
        updatedAt: taskAnswers.updatedAt,
      });

    if (!row) {
      throw new Error("Failed to save answers");
    }

    return {
      answers: (row.answers as Record<string, unknown>) || {},
      updated_at: toIso(row.updatedAt),
    } satisfies TaskAnswersRow;
  },

  async updateStatus(taskId, status) {
    const db = getDb();
    await db
      .update(tasks)
      .set({ status, updatedAt: new Date() })
      .where(eq(tasks.id, taskId));
  },

  async getPublicBySlug(slug) {
    const db = getDb();
    const [row] = await db
      .select({
        slug: tasks.slug,
        title: tasks.title,
        studentName: tasks.studentName,
        htmlContent: tasks.htmlContent,
        status: tasks.status,
        updatedAt: tasks.updatedAt,
        answers: taskAnswers.answers,
        answersUpdatedAt: taskAnswers.updatedAt,
      })
      .from(tasks)
      .leftJoin(taskAnswers, eq(taskAnswers.taskId, tasks.id))
      .where(eq(tasks.slug, slug))
      .limit(1);

    if (!row) return null;

    return {
      slug: row.slug,
      title: row.title,
      student_name: row.studentName,
      html_content: row.htmlContent,
      status: row.status,
      updated_at: toIso(row.updatedAt),
      answers: (row.answers as TaskAnswers) || {},
      answers_updated_at: row.answersUpdatedAt
        ? toIso(row.answersUpdatedAt)
        : null,
    } satisfies PublicTaskView;
  },

  async getIdStatusBySlug(slug) {
    const db = getDb();
    const [row] = await db
      .select({ id: tasks.id, status: tasks.status })
      .from(tasks)
      .where(eq(tasks.slug, slug))
      .limit(1);

    return row ? (row as TaskIdStatus) : null;
  },

  async getTitleBySlug(slug) {
    const db = getDb();
    const [row] = await db
      .select({ title: tasks.title })
      .from(tasks)
      .where(eq(tasks.slug, slug))
      .limit(1);

    return row?.title ?? null;
  },
};
