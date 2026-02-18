'use client';

import { useEffect, useRef } from 'react';
import { Layer } from '@/types/hierarchy.types';
import { STATUS_DOT_CLASSES } from '@/lib/constants/status';

interface SiblingNavigatorProps {
  siblings: Layer[];
  currentLayerId: string;
  label: string;
  onSelect: (sibling: Layer) => void;
}

export function SiblingNavigator({ siblings, currentLayerId, label, onSelect }: SiblingNavigatorProps) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Show in reverse order so highest floor is at top
  const sorted = [...siblings].reverse();

  // Auto-scroll to active item on mount
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const active = activeRef.current;
      const offset = active.offsetTop - container.offsetTop - container.clientHeight / 2 + active.clientHeight / 2;
      container.scrollTo({ top: offset, behavior: 'smooth' });
    }
  }, [currentLayerId]);

  return (
    <aside className="hidden lg:flex w-28 glass-panel rounded-none rounded-l-2xl ml-0 flex-col border-l-0">
      <div className="px-3 py-3 border-b border-white/10">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {label}es
        </span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex flex-col py-1">
          {sorted.map((sibling) => {
            const isCurrent = sibling.id === currentLayerId;
            return (
              <button
                key={sibling.id}
                ref={isCurrent ? activeRef : undefined}
                onClick={() => onSelect(sibling)}
                className={`
                  flex items-center gap-2 px-3 py-2 text-sm transition-colors outline-none
                  ${isCurrent
                    ? 'bg-white/15 text-white font-semibold border-l-2 border-white'
                    : 'text-gray-400 hover:bg-white/10 hover:text-white'
                  }
                `}
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT_CLASSES[sibling.status]}`} />
                <span className="truncate">{sibling.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
