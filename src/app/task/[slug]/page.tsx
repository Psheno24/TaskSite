import type { Metadata } from "next";
import { StudentTaskPage } from "@/components/task/StudentTaskPage";
import { getTaskStore } from "@/lib/data/tasks";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const title = await getTaskStore().getTitleBySlug(slug);

  return {
    title: title || "TaskSite",
  };
}

export default async function TaskPage({ params }: PageProps) {
  const { slug } = await params;
  return <StudentTaskPage slug={slug} />;
}
