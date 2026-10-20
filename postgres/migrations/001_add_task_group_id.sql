-- Add group_id so multiple student copies share one assignment group.
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS group_id UUID;
CREATE INDEX IF NOT EXISTS idx_tasks_group_id ON public.tasks(group_id);
