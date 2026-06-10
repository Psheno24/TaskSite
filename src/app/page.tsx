import { redirect } from "next/navigation";
import { getTeacher } from "@/lib/auth";

export default async function HomePage() {
  const teacher = await getTeacher();
  redirect(teacher ? "/dashboard" : "/login");
}
