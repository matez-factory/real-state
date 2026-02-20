import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import AdminSidebar from '@/components/admin/AdminSidebar';
import TourPageClient from './client';

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function TourPage({ params }: Props) {
  const { projectId } = await params;
  const supabase = createAdminClient();

  const { data: project } = await supabase
    .from('projects')
    .select('id, slug, name')
    .eq('id', projectId)
    .single();

  if (!project) notFound();

  // Find the tour layer
  const { data: tourLayer } = await supabase
    .from('layers')
    .select('id')
    .eq('project_id', projectId)
    .eq('type', 'tour')
    .single();

  // Get all tour media
  const tourMedia = tourLayer
    ? (await supabase
        .from('media')
        .select('*')
        .eq('layer_id', tourLayer.id)
        .order('sort_order')).data ?? []
    : [];

  return (
    <div className="flex min-h-screen">
      <AdminSidebar projectId={projectId} projectName={project.name} />
      <div className="flex-1 p-8">
        <TourPageClient
          projectId={projectId}
          projectSlug={project.slug}
          tourLayerId={tourLayer?.id ?? null}
          tourMedia={tourMedia}
        />
      </div>
    </div>
  );
}
