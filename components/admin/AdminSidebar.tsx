'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FolderTree, Image, Navigation, Boxes } from 'lucide-react';

interface Props {
  projectId?: string;
  projectName?: string;
}

export default function AdminSidebar({ projectId, projectName }: Props) {
  const pathname = usePathname();

  const mainLinks = [
    { href: '/admin', label: 'Proyectos', icon: LayoutDashboard },
  ];

  const projectLinks = projectId
    ? [
        { href: `/admin/projects/${projectId}`, label: 'General', icon: LayoutDashboard },
        { href: `/admin/projects/${projectId}/layers`, label: 'Layers', icon: FolderTree },
        { href: `/admin/projects/${projectId}/unit-types`, label: 'Tipos de Unidad', icon: Boxes },
        { href: `/admin/projects/${projectId}/media`, label: 'Media', icon: Image },
        { href: `/admin/projects/${projectId}/tour`, label: 'Tour 360', icon: Navigation },
      ]
    : [];

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin';
    return pathname === href;
  }

  return (
    <aside className="w-56 bg-gray-900 text-gray-300 flex flex-col shrink-0">
      <div className="px-4 py-4 border-b border-gray-800">
        <Link href="/admin" className="text-white font-semibold text-sm">
          Admin Panel
        </Link>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        {mainLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive(link.href)
                  ? 'bg-gray-800 text-white'
                  : 'hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon size={16} />
              {link.label}
            </Link>
          );
        })}

        {projectId && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Proyecto
              </p>
              <p className="text-sm text-white truncate mt-1">{projectName || 'Cargando...'}</p>
            </div>

            {projectLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive(link.href)
                      ? 'bg-gray-800 text-white'
                      : 'hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <Icon size={16} />
                  {link.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>
    </aside>
  );
}
