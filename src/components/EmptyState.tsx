import React from 'react';
import { PackageOpen, SearchX, Plus } from 'lucide-react';

interface EmptyStateProps {
  type: 'no-items' | 'no-search' | 'no-collections';
  searchQuery?: string;
  onAction?: () => void;
  actionLabel?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  type,
  searchQuery,
  onAction,
  actionLabel,
}) => {
  if (type === 'no-search') {
    return (
      <div className="text-center py-16 px-4 bg-white rounded-3xl border border-slate-200/80 shadow-xs max-w-lg mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <SearchX className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-1">
          Žádné položky neodpovídají hledání
        </h3>
        <p className="text-xs text-slate-500 mb-5 leading-relaxed">
          Pro výraz <strong className="text-slate-800">„{searchQuery}“</strong> jsme v této sekci nic nenašli.
          Zkuste zkontrolovat překlepy nebo vymazat filtr.
        </p>
        {onAction && (
          <button
            type="button"
            onClick={onAction}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Vymazat hledání
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="text-center py-16 px-4 bg-white rounded-3xl border border-dashed border-slate-300 max-w-md mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
        <PackageOpen className="w-7 h-7" />
      </div>
      <h3 className="text-base font-bold text-slate-900 mb-1">
        {type === 'no-collections'
          ? 'Zatím nemáte žádnou sekci'
          : 'Tato sekce je zatím prázdná'}
      </h3>
      <p className="text-xs text-slate-500 mb-5 leading-relaxed">
        {type === 'no-collections'
          ? 'Vytvořte svou první sekci a začněte evidovat cokoliv od aut po modely.'
          : 'Přidejte svou první položku a vyplňte její vlastnosti.'}
      </p>
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-100 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {actionLabel || 'Přidat položku'}
        </button>
      )}
    </div>
  );
};
