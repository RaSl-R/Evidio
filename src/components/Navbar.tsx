import React from 'react';
import { Collection } from '../types';
import { Box, Plus } from 'lucide-react';

interface NavbarProps {
  collections: Collection[];
  activeCollection: Collection | null;
  onSelectCollection: (collection: Collection) => void;
  onOpenCreateCollection: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  collections,
  activeCollection,
  onSelectCollection,
  onOpenCreateCollection,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        {/* Top App Branding */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-xs">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-slate-900">
                  Evidio
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 uppercase tracking-wide">
                  Osobní inventář
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Prominent Section Switcher Tabs & "+ Nová sekce" */}
        <div className="flex items-center gap-2.5">
          {/* Scrollable Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 scroll-smooth max-w-full">
            {collections.map((col) => {
              const isActive = activeCollection?.id === col.id;
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => onSelectCollection(col)}
                  className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 scale-[1.02]'
                      : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 hover:text-slate-900 border border-slate-200/60'
                  }`}
                >
                  <span>{col.name}</span>
                </button>
              );
            })}

            {/* Prominent "+ Nová sekce" Button */}
            <button
              type="button"
              onClick={onOpenCreateCollection}
              className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/60 text-sm font-bold transition-all hover:scale-[1.02]"
              title="Vytvořit novou sekci"
              aria-label="Vytvořit novou sekci"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span className="hidden sm:inline">Nová sekce</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
