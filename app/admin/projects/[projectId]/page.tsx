import AdminSidebar from '@/components/admin/AdminSidebar';
import ProjectForm from '@/components/admin/ProjectForm';
import DeleteProjectButton from '@/components/admin/DeleteProjectButton';
import { updateProject } from '@/lib/actions/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function EditProjectPage({ params }: Props) {
  const { projectId } = await params;
  const supabase = createAdminClient();

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (!project) notFound();

  const updateAction = updateProject.bind(null, projectId);

  return (
    <div className="flex min-h-screen">
      <AdminSidebar projectId={projectId} projectName={project.name} />
      <div className="flex-1 p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Editar: {project.name}</h1>
          <DeleteProjectButton projectId={projectId} />
        </div>
        <ProjectForm
          project={{
            ...project,
            layer_labels: project.layer_labels as string[],
            coordinates: project.coordinates as { lat: number; lng: number } | null,
          }}
          action={updateAction}
          isEdit
        />
      </div>
    </div>
  );
}
