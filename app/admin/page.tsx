import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { PROJECT_STATUS_LABELS } from '@/lib/constants/status';
import type { ProjectStatus, ProjectType } from '@/types/hierarchy.types';
import { Plus } from 'lucide-react';

const TYPE_LABELS: Record<ProjectType, string> = {
  lots: 'Loteo',
  building: 'Edificio',
  masterplan: 'Masterplan',
};

export default async function AdminProjectsPage() {
  const supabase = createAdminClient();
  const { data: projects } = await supabase
    .from('projects')
    .select('id, slug, name, type, status, created_at')
    .order('created_at', { ascending: false });

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex-1 p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Proyectos</h1>
          <Link
            href="/admin/projects/new"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Nuevo proyecto
          </Link>
        </div>

        {!projects?.length ? (
          <p className="text-gray-500">No hay proyectos. Crea el primero.</p>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Slug</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {projects.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {TYPE_LABELS[p.type as ProjectType] ?? p.type}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status as ProjectStatus} />
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.slug}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/projects/${p.id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ProjectStatus }) {
  const colors: Record<ProjectStatus, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    active: 'bg-green-100 text-green-800',
    archived: 'bg-gray-100 text-gray-600',
  };

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[status]}`}>
      {PROJECT_STATUS_LABELS[status]}
    </span>
  );
}
