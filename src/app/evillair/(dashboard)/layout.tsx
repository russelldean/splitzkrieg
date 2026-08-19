import { requireAdminOrWriterPage } from '@/lib/admin/auth-page';
import { AdminShell } from '../AdminShell';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const payload = await requireAdminOrWriterPage();
  return <AdminShell role={payload.role}>{children}</AdminShell>;
}
