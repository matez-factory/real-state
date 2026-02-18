import { createAdminClient } from '@/lib/supabase/admin';
import { ExplorerPageData } from '@/types/hierarchy.types';
import {
  RawProject,
  RawLayer,
  RawMedia,
  buildExplorerPageData,
  generateAllLayerPaths,
} from './transform';

/**
 * Fetch explorer page data using the admin client (no cookies).
 * Used in generateStaticParams where request context is not available.
 */
export async function getExplorerPageDataAdmin(
  projectSlug: string,
  layerSlugs: string[]
): Promise<ExplorerPageData> {
  const supabase = createAdminClient();

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', projectSlug)
    .single();

  if (projectError || !project) {
    throw new Error(`Project not found: ${projectSlug}`);
  }

  const rawProject = project as RawProject;

  const [layersResult, mediaResult] = await Promise.all([
    supabase
      .from('layers')
      .select('*')
      .eq('project_id', rawProject.id)
      .order('depth')
      .order('sort_order'),
    supabase
      .from('media')
      .select('*')
      .eq('project_id', rawProject.id)
      .order('sort_order'),
  ]);

  if (layersResult.error) {
    throw new Error(`Failed to fetch layers for project "${projectSlug}": ${layersResult.error.message}`);
  }
  if (mediaResult.error) {
    throw new Error(`Failed to fetch media for project "${projectSlug}": ${mediaResult.error.message}`);
  }

  return buildExplorerPageData(
    rawProject,
    layersResult.data as RawLayer[],
    mediaResult.data as RawMedia[],
    layerSlugs
  );
}

/**
 * Get all project slugs for generateStaticParams.
 * Returns empty array on failure to avoid breaking the build.
 */
export async function getProjectSlugsAdmin(): Promise<string[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('projects')
    .select('slug')
    .order('slug');

  if (error || !data) return [];
  return data.map((p) => p.slug);
}

/**
 * Get all valid layer paths for a project (for generateStaticParams).
 * Returns arrays of slugs, e.g. [["zona-a"], ["zona-a", "manzana-1"], ...]
 */
export async function getLayerPathsAdmin(
  projectSlug: string
): Promise<string[][]> {
  const supabase = createAdminClient();

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('slug', projectSlug)
    .single();

  // Silent failure is intentional: static generation should not break the build
  // if a project is missing or has no layers.
  if (projectError || !project) return [];

  const { data: layers, error: layersError } = await supabase
    .from('layers')
    .select('id, parent_id, slug, depth, sort_order')
    .eq('project_id', project.id)
    .order('depth')
    .order('sort_order');

  if (layersError || !layers) return [];

  return generateAllLayerPaths(layers as RawLayer[]);
}

