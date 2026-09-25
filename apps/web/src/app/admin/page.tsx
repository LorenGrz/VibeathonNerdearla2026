import type { Metadata } from 'next';
import { Header } from '@/components/Header';
import { AdminDashboard } from '@/features/admin/components/AdminDashboard';

export const metadata: Metadata = {
  title: 'Panel de producción · LiveSubs',
};

// TODO(auth): sin autenticación en el MVP; este panel queda abierto a quien tenga la URL.
// Fuera de alcance de T9 — ver docs/planning/tasks/T09-web-admin.md.
export default function AdminPage() {
  return (
    <div className="flex flex-1 flex-col">
      <Header />
      <AdminDashboard />
    </div>
  );
}
