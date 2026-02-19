import { createClient } from '@/lib/supabase/server';
import { ExplorerPageData, SiblingExplorerBundle, LotsProjectBundle, Project } from '@/types/hierarchy.types';
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
 * Fetch lots project bundle: home (project root) + first zone in one DB round-trip.
 */
export async function getLotsProjectBundle(
  projectSlug: string
): Promise<LotsProjectBundle> {
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
    throw new Error(`Failed to fetch layers: ${layersResult.error.message}`);
  }
  if (mediaResult.error) {
    throw new Error(`Failed to fetch media: ${mediaResult.error.message}`);
  }

  const rawLayers = layersResult.data as RawLayer[];
  const rawMedia = mediaResult.data as RawMedia[];

  // Detect first zone slug (depth=0)
  const zoneSlug = rawLayers.find((l) => l.depth === 0)?.slug;

  return {
    home: buildExplorerPageData(rawProject, rawLayers, rawMedia, []),
    zone: buildExplorerPageData(rawProject, rawLayers, rawMedia, zoneSlug ? [zoneSlug] : []),
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
