import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { ExplorerPageData, SiblingExplorerBundle, LotsProjectBundle, Project } from '@/types/hierarchy.types';
import {
  RawProject,
  RawLayer,
  RawMedia,
  RawUnitType,
  buildExplorerPageData,
  buildSiblingExplorerBundle,
  transformProject,
} from './transform';

// ============================================================
// Cached raw data fetcher
// ============================================================

export interface ProjectRawData {
  rawProject: RawProject;
  rawLayers: RawLayer[];
  rawMedia: RawMedia[];
  rawUnitTypes: RawUnitType[];
}

/**
 * Fetch all raw data for a project (project + layers + media + unit_types).
 * Uses the admin client (no cookies) so the result is safely cacheable.
 * Cached via unstable_cache with a per-project tag for on-demand revalidation.
 */
export function fetchProjectRawData(projectSlug: string): Promise<ProjectRawData> {
  return unstable_cache(
    async (slug: string): Promise<ProjectRawData> => {
      const supabase = createAdminClient();

      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('slug', slug)
        .single();

      if (projectError || !project) {
        throw new Error(`Project not found: ${slug}`);
      }

      const rawProject = project as RawProject;

      const [layersResult, mediaResult, unitTypesResult] = await Promise.all([
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
        supabase
          .from('unit_types')
          .select('*')
          .eq('project_id', rawProject.id),
      ]);

      if (layersResult.error) {
        throw new Error(`Failed to fetch layers for project "${slug}": ${layersResult.error.message}`);
      }
      if (mediaResult.error) {
        throw new Error(`Failed to fetch media for project "${slug}": ${mediaResult.error.message}`);
      }
      if (unitTypesResult.error) {
        throw new Error(`Failed to fetch unit_types for project "${slug}": ${unitTypesResult.error.message}`);
      }

      return {
        rawProject,
        rawLayers: layersResult.data as RawLayer[],
        rawMedia: mediaResult.data as RawMedia[],
        rawUnitTypes: unitTypesResult.data as RawUnitType[],
      };
    },
    [`project-data:${projectSlug}`],
    {
      tags: [`project-data:${projectSlug}`],
      revalidate: 3600,
    }
  )(projectSlug);
}

// ============================================================
// Public data accessors (use cached raw data)
// ============================================================

/**
 * Fetch explorer page data for a project at a given layer path.
 */
export async function getExplorerPageData(
  projectSlug: string,
  layerSlugs: string[]
): Promise<ExplorerPageData> {
  const { rawProject, rawLayers, rawMedia, rawUnitTypes } =
    await fetchProjectRawData(projectSlug);

  return buildExplorerPageData(rawProject, rawLayers, rawMedia, layerSlugs, rawUnitTypes);
}

/**
 * Fetch explorer data for a layer AND all its siblings in one DB round-trip.
 * Returns a bundle that enables client-side floor switching with no extra fetches.
 */
export async function getSiblingExplorerBundle(
  projectSlug: string,
  layerSlugs: string[]
): Promise<SiblingExplorerBundle> {
  const { rawProject, rawLayers, rawMedia, rawUnitTypes } =
    await fetchProjectRawData(projectSlug);

  return buildSiblingExplorerBundle(rawProject, rawLayers, rawMedia, layerSlugs, rawUnitTypes);
}

/**
 * Fetch lots project bundle: home (project root) + first zone in one DB round-trip.
 */
export async function getLotsProjectBundle(
  projectSlug: string
): Promise<LotsProjectBundle> {
  const { rawProject, rawLayers, rawMedia, rawUnitTypes } =
    await fetchProjectRawData(projectSlug);

  const zoneSlug = rawLayers.find((l) => l.depth === 0)?.slug;

  return {
    home: buildExplorerPageData(rawProject, rawLayers, rawMedia, [], rawUnitTypes),
    zone: buildExplorerPageData(rawProject, rawLayers, rawMedia, zoneSlug ? [zoneSlug] : [], rawUnitTypes),
  };
}

/**
 * Fetch all projects.
 */
export async function getProjects(): Promise<Project[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('status', 'active')
    .order('name');

  if (error) {
    throw new Error(`Failed to fetch projects: ${error.message}`);
  }
  return (data as RawProject[]).map(transformProject);
}
