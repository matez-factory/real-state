import { signOut } from '@/lib/actions/auth';
import { getAuthUser } from '@/lib/supabase/auth';

export const metadata = { title: 'Admin - Explorador Inmobiliario' };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <header className="bg-white border-b border-gray-200 px-4 py-3 shadow-sm flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900">Admin</span>
        <div className="flex items-center gap-4">
          {user && <span className="text-sm text-gray-500">{user.email}</span>}
          <form action={signOut}>
            <button className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Cerrar sesion
            </button>
          </form>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
