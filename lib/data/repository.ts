import { createClient } from '@/lib/supabase/server';
import { ExplorerPageData, SiblingExplorerBundle, Project } from '@/types/hierarchy.types';
import {
  RawProject,
  RawLayer,
  RawMedia,
  buildExplorerPageData,
  buildSiblingExplorerBundle,
  transformProject,
} from './transform';

/**
 * Fetch explorer page data for a project at a given layer path.
 * Uses the server client (cookie-based) for runtime requests.
 */
export async function getExplorerPageData(
  projectSlug: string,
  layerSlugs: string[]
): Promise<ExplorerPageData> {
  const supabase = await createClient();

  // Fetch project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', projectSlug)
    .single();

  if (projectError || !project) {
    throw new Error(`Project not found: ${projectSlug}`);
  }

  const rawProject = project as RawProject;

  // Fetch all layers and media for this project in parallel
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
 * Fetch explorer data for a layer AND all its siblings in one DB round-trip.
 * Returns a bundle that enables client-side floor switching with no extra fetches.
 */
export async function getSiblingExplorerBundle(
  projectSlug: string,
  layerSlugs: string[]
): Promise<SiblingExplorerBundle> {
  const supabase = await createClient();

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

  return buildSiblingExplorerBundle(
    rawProject,
    layersResult.data as RawLayer[],
    mediaResult.data as RawMedia[],
    layerSlugs
  );
}

/**
 * Fetch all projects.
 */
export async function getProjects(): Promise<Project[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('name');

  if (error) {
    throw new Error(`Failed to fetch projects: ${error.message}`);
  }
  return (data as RawProject[]).map(transformProject);
}
