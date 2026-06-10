import { TaskViewer } from "@/components/dashboard/TaskViewer";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TaskViewPage({ params }: PageProps) {
  const { id } = await params;
  return <TaskViewer taskId={id} />;
}
