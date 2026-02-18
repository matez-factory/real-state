import Link from 'next/link';
import { BreadcrumbItem } from '@/types/hierarchy.types';

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex items-center space-x-2 text-sm">
      {items.map((item, index) => (
        <div key={index} className="flex items-center">
          {index > 0 && <span className="mx-2 text-gray-600">/</span>}
          {item.href ? (
            <Link
              href={item.href}
              className="text-gray-400 hover:text-white hover:underline"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-white font-medium" aria-current="page">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}
