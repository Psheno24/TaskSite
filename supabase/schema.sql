-- TaskSite: Supabase schema
-- Run this in Supabase SQL Editor after creating a new project.

-- ============================================================
-- ENUM
-- ============================================================

CREATE TYPE public.task_status AS ENUM ('not_started', 'in_progress', 'completed');

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'teacher' CHECK (role = 'teacher'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  student_name TEXT NOT NULL,
  html_content TEXT NOT NULL,
  status public.task_status NOT NULL DEFAULT 'not_started',
  teacher_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.task_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL UNIQUE REFERENCES public.tasks(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_tasks_teacher_id ON public.tasks(teacher_id);
CREATE INDEX idx_tasks_slug ON public.tasks(slug);
CREATE INDEX idx_tasks_created_at ON public.tasks(created_at DESC);
CREATE INDEX idx_task_answers_task_id ON public.task_answers(task_id);

-- ============================================================
-- TRIGGERS: auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER task_answers_updated_at
  BEFORE UPDATE ON public.task_answers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- TRIGGER: create user profile on signup
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role)
  VALUES (NEW.id, NEW.email, 'teacher');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_answers ENABLE ROW LEVEL SECURITY;

-- users: teacher can read/update own profile
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- tasks: teacher CRUD on own tasks
CREATE POLICY "Teachers can view own tasks"
  ON public.tasks FOR SELECT
  USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can create tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers can update own tasks"
  ON public.tasks FOR UPDATE
  USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can delete own tasks"
  ON public.tasks FOR DELETE
  USING (auth.uid() = teacher_id);

-- task_answers: teacher access via task ownership
CREATE POLICY "Teachers can view answers for own tasks"
  ON public.task_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_answers.task_id
        AND tasks.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can insert answers for own tasks"
  ON public.task_answers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_answers.task_id
        AND tasks.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can update answers for own tasks"
  ON public.task_answers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_answers.task_id
        AND tasks.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can delete answers for own tasks"
  ON public.task_answers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_answers.task_id
        AND tasks.teacher_id = auth.uid()
    )
  );

-- ============================================================
-- SETUP INSTRUCTIONS
-- ============================================================
-- 1. Run this entire script in Supabase SQL Editor.
-- 2. Create a teacher account:
--    Dashboard → Authentication → Users → Add user
--    (email + password). The trigger will create a row in public.users.
-- 3. Copy project URL and keys to .env.local
