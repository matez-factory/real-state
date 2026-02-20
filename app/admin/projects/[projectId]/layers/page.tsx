import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import AdminSidebar from '@/components/admin/AdminSidebar';
import LayersPageClient from './client';

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function LayersPage({ params }: Props) {
  const { projectId } = await params;
  const supabase = createAdminClient();

  const { data: project } = await supabase
    .from('projects')
    .select('id, slug, name')
    .eq('id', projectId)
    .single();

  if (!project) notFound();

  const { data: layers } = await supabase
    .from('layers')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });

  return (
    <div className="flex min-h-screen">
      <AdminSidebar projectId={projectId} projectName={project.name} />
      <div className="flex-1 p-8">
        <LayersPageClient
          projectId={projectId}
          projectSlug={project.slug}
          projectName={project.name}
          rawLayers={layers ?? []}
        />
      </div>
    </div>
  );
}
