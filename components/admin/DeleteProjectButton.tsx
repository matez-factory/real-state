'use client';

import { deleteProject } from '@/lib/actions/admin';

export default function DeleteProjectButton({ projectId }: { projectId: string }) {
  const deleteAction = deleteProject.bind(null, projectId);

  return (
    <form action={deleteAction}>
      <button
        type="submit"
        className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        onClick={(e) => {
          if (!confirm('Eliminar este proyecto y todos sus datos?')) {
            e.preventDefault();
          }
        }}
      >
        Eliminar proyecto
      </button>
    </form>
  );
}
