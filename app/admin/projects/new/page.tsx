import AdminSidebar from '@/components/admin/AdminSidebar';
import ProjectForm from '@/components/admin/ProjectForm';
import { createProject } from '@/lib/actions/admin';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function NewProjectPage() {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex-1 p-8">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft size={14} />
          Volver a proyectos
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Nuevo Proyecto</h1>
        <ProjectForm action={createProject} />
      </div>
    </div>
  );
}
