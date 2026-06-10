import type { Metadata } from "next";
import { StudentTaskPage } from "@/components/task/StudentTaskPage";
import { createServiceClient } from "@/lib/supabase/server";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createServiceClient();

  const { data: task } = await supabase
    .from("tasks")
    .select("title")
    .eq("slug", slug)
    .single();

  return {
    title: task?.title || "TaskSite",
  };
}

export default async function TaskPage({ params }: PageProps) {
  const { slug } = await params;
  return <StudentTaskPage slug={slug} />;
}
