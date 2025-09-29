
import { ProtectedRoute } from "@/layouts/protected-route";

export default function ManageCoursesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedRoute allowedRoles={['teacher', 'developer']}>{children}</ProtectedRoute>;
}
