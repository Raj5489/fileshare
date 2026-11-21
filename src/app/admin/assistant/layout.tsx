/**
 * Admin layout — server component that gate-checks admin auth.
 * Unauthenticated → /admin/assistant/login
 * Not in ADMIN_EMAILS → /admin/assistant/login
 */
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/assistant/admin-auth";
import AdminShell from "@/components/assistant/admin/AdminShell";

export const metadata = { title: "Support Admin — FileShare" };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");

  return <AdminShell>{children}</AdminShell>;
}
