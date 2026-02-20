import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import AdminSidebar from '@/components/admin/AdminSidebar';
import ProjectMediaClient from './client';

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectMediaPage({ params }: Props) {
  const { projectId } = await params;
  const supabase = createAdminClient();

  const { data: project } = await supabase
    .from('projects')
    .select('id, slug, name, logo_url, secondary_logo_url')
    .eq('id', projectId)
    .single();

  if (!project) notFound();

  // Get project-level media (layer_id IS NULL)
  const { data: media } = await supabase
    .from('media')
    .select('*')
    .eq('project_id', projectId)
    .is('layer_id', null)
    .order('purpose');

  return (
    <div className="flex min-h-screen">
      <AdminSidebar projectId={projectId} projectName={project.name} />
      <div className="flex-1 p-8">
        <ProjectMediaClient
          projectId={projectId}
          projectSlug={project.slug}
          media={media ?? []}
          logoUrl={project.logo_url}
          secondaryLogoUrl={project.secondary_logo_url}
        />
      </div>
    </div>
  );
}
