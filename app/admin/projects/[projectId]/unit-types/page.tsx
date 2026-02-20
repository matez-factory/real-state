import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import AdminSidebar from '@/components/admin/AdminSidebar';
import UnitTypesClient from './client';

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function UnitTypesPage({ params }: Props) {
  const { projectId } = await params;
  const supabase = createAdminClient();

  const { data: project } = await supabase
    .from('projects')
    .select('id, slug, name')
    .eq('id', projectId)
    .single();

  if (!project) notFound();

  const { data: unitTypes } = await supabase
    .from('unit_types')
    .select('*')
    .eq('project_id', projectId)
    .order('name');

  // Fetch media with unit_type_id for this project
  const { data: media } = await supabase
    .from('media')
    .select('*')
    .eq('project_id', projectId)
    .not('unit_type_id', 'is', null);

  return (
    <div className="flex min-h-screen">
      <AdminSidebar projectId={projectId} projectName={project.name} />
      <div className="flex-1 p-8">
        <UnitTypesClient
          projectId={projectId}
          projectSlug={project.slug}
          unitTypes={unitTypes ?? []}
          media={media ?? []}
        />
      </div>
    </div>
  );
}
