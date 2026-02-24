import { fetchProjectRawData } from '@/lib/data/repository';
import { collectPreloadUrls } from '@/lib/collectPreloadUrls';
import { ProjectPreloader } from '@/components/shared/ProjectPreloader';

interface Props {
  params: Promise<{ projectSlug: string }>;
  children: React.ReactNode;
}

export default async function ProjectLayout({ params, children }: Props) {
  const { projectSlug } = await params;

  let bgUrl: string | null = null;
  let preloadUrls: string[] = [];
  let projectName = '';

  try {
    const { rawProject, rawLayers, rawMedia } = await fetchProjectRawData(projectSlug);

    projectName = rawProject.name;
    preloadUrls = collectPreloadUrls(rawLayers, rawMedia);

    // Root-level background image (layer_id IS NULL, unit_type_id IS NULL, purpose = 'background')
    const bg = rawMedia.find(
      (m) =>
        !m.layer_id &&
        !m.unit_type_id &&
        m.purpose === 'background' &&
        m.type === 'image'
    );
    bgUrl = bg?.url ?? null;
  } catch {
    // Project not found — children will handle the error
  }

  return (
    <>
      {bgUrl && (
        <img
          src={bgUrl}
          alt=""
          aria-hidden
          // eslint-disable-next-line react/no-unknown-property
          fetchPriority="high"
          className="fixed inset-0 w-full h-full object-cover blur-sm brightness-50 -z-10 pointer-events-none"
        />
      )}
      <ProjectPreloader
        urls={preloadUrls}
        projectName={projectName}
        projectSlug={projectSlug}
      >
        {children}
      </ProjectPreloader>
    </>
  );
}
