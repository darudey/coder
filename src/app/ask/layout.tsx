
import { ProtectedRoute } from "@/layouts/protected-route";

export default function AskQuestionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedRoute allowedRoles={['teacher', 'developer']}>{children}</ProtectedRoute>;
}
