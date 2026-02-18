import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getProjects } from '@/lib/data/repository';
import { STATUS_CLASSES, STATUS_LABELS } from '@/lib/constants/status';

export default async function HomePage() {
  const projects = await getProjects();

  // If only one project, redirect directly to it
  if (projects.length === 1) {
    redirect(`/p/${projects[0].slug}`);
  }

  // Multiple projects: show a listing
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-black">
      <header className="glass-panel mx-4 mt-4 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-white">Explorador Inmobiliario</h1>
          <p className="text-gray-400 mt-2">Selecciona un proyecto para explorar</p>
        </div>
      </header>

      <main id="main-content" className="max-w-4xl mx-auto p-6">
        <div className="grid gap-6 md:grid-cols-2">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/p/${project.slug}`}
              className="block glass-panel p-5 hover:bg-white/10 hover:shadow-lg hover:shadow-blue-500/10 transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 font-medium">
                  {project.type === 'subdivision' ? 'Loteo' : 'Edificio'}
                </span>
                <span className={`text-sm px-2 py-1 rounded-full font-medium ${STATUS_CLASSES[project.status]}`}>
                  {STATUS_LABELS[project.status]}
                </span>
              </div>
              <h2 className="text-xl font-bold text-white">{project.name}</h2>
              {project.description && (
                <p className="text-gray-400 mt-2 text-sm">{project.description}</p>
              )}
              {(project.city || project.state) && (
                <p className="text-gray-500 mt-2 text-sm">
                  {[project.city, project.state].filter(Boolean).join(', ')}
                </p>
              )}
            </Link>
          ))}
        </div>

        {projects.length === 0 && (
          <div className="text-center text-gray-500 py-12">
            No hay proyectos disponibles
          </div>
        )}
      </main>
    </div>
  );
}
