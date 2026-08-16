import {
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const taskStatusEnum = pgEnum("task_status", [
  "not_started",
  "in_progress",
  "completed",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("teacher"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    studentName: text("student_name").notNull(),
    htmlContent: text("html_content").notNull(),
    status: taskStatusEnum("status").notNull().default("not_started"),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_tasks_teacher_id").on(table.teacherId),
    index("idx_tasks_slug").on(table.slug),
    index("idx_tasks_created_at").on(table.createdAt),
  ]
);

export const taskAnswers = pgTable(
  "task_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    answers: jsonb("answers").$type<Record<string, unknown>>().notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("task_answers_task_id_unique").on(table.taskId),
    index("idx_task_answers_task_id").on(table.taskId),
  ]
);

export type DbUser = typeof users.$inferSelect;
export type DbTask = typeof tasks.$inferSelect;
export type DbTaskAnswer = typeof taskAnswers.$inferSelect;
