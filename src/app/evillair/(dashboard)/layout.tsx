import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/admin/auth';
import { AdminShell } from '../AdminShell';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin-token')?.value;

  if (!token) {
    redirect('/evillair/login');
  }

  const payload = await verifyToken(token);
  if (!payload || (payload.role !== 'admin' && payload.role !== 'writer')) {
    redirect('/evillair/login');
  }

  return <AdminShell role={payload.role}>{children}</AdminShell>;
}
