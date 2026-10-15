import React, { useState, useMemo } from 'react';
import { ReminderItem, formatRelativeDays } from '../utils/reminders';
import { formatDateLabel } from '../utils/itemHelpers';
import { Item, Collection, CollectionGroup } from '../types';
import {
  X,
  Bell,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface RemindersOverviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  reminders: ReminderItem[];
  items: Item[];
  collections: Collection[];
  collectionGroups: CollectionGroup[];
  activeCollection: Collection | null;
  onNavigateToItem: (
    item: Item,
    collection: Collection,
    group: CollectionGroup | null
  ) => void;
}

export const RemindersOverviewModal: React.FC<RemindersOverviewModalProps> = ({
  isOpen,
  onClose,
  reminders,
  items,
  collections,
  collectionGroups,
  activeCollection,
  onNavigateToItem,
}) => {
  // Filter state
  const [scope, setScope] = useState<'all' | 'current'>('all');
  const [showLater, setShowLater] = useState(false);

  // Maps for quick lookups
  const itemsMap = useMemo(() => {
    const map = new Map<string, Item>();
    for (const item of items) {
      map.set(item.id, item);
    }
    return map;
  }, [items]);

  const collectionsMap = useMemo(() => {
    const map = new Map<string, Collection>();
    for (const col of collections) {
      map.set(col.id, col);
    }
    return map;
  }, [collections]);

  const groupsMap = useMemo(() => {
    const map = new Map<string, CollectionGroup>();
    for (const grp of collectionGroups) {
      map.set(grp.id, grp);
    }
    return map;
  }, [collectionGroups]);

  // Filtered reminders
  const filteredReminders = useMemo(() => {
    return reminders.filter((r) => {
      // Scope filter
      if (scope === 'current' && activeCollection) {
        if (r.collectionId !== activeCollection.id) return false;
      }
      // Status filter
      if (!showLater && r.status === 'later') {
        return false;
      }
      return true;
    });
  }, [reminders, scope, activeCollection, showLater]);

  // Grouped by status
  const overdueGroup = useMemo(
    () => filteredReminders.filter((r) => r.status === 'overdue'),
    [filteredReminders]
  );
  const todayGroup = useMemo(
    () => filteredReminders.filter((r) => r.status === 'today'),
    [filteredReminders]
  );
  const soonGroup = useMemo(
    () => filteredReminders.filter((r) => r.status === 'soon'),
    [filteredReminders]
  );
  const laterGroup = useMemo(
    () => filteredReminders.filter((r) => r.status === 'later'),
    [filteredReminders]
  );

  if (!isOpen) return null;

  const handleRowClick = (reminder: ReminderItem) => {
    const item = itemsMap.get(reminder.itemId);
    const col = collectionsMap.get(reminder.collectionId);
    if (!item || !col) return;
    const group = col.group_id ? groupsMap.get(col.group_id) || null : null;
    onClose();
    onNavigateToItem(item, col, group);
  };

  const renderReminderRow = (reminder: ReminderItem) => {
    const item = itemsMap.get(reminder.itemId);
    const col = collectionsMap.get(reminder.collectionId);
    const isOverdue = reminder.status === 'overdue';
    const isToday = reminder.status === 'today';
    const isSoon = reminder.status === 'soon';

    return (
      <div
        key={`${reminder.itemId}-${reminder.fieldId}`}
        onClick={() => handleRowClick(reminder)}
        className="p-3 sm:p-3.5 rounded-xl border border-slate-200/90 hover:border-indigo-300 hover:shadow-xs transition-all bg-white flex items-center justify-between gap-3 cursor-pointer group"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
              {item ? item.name : 'Neznámá položka'}
            </span>
            {col && (
              <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate">
                · {col.name}
              </span>
            )}
          </div>

          <div className="text-xs text-slate-600 font-medium truncate mt-0.5">
            {reminder.fieldName}
          </div>
        </div>

        {/* Date and Status Badge */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="text-right">
            <div className="text-xs font-semibold text-slate-800">
              {formatDateLabel(reminder.dueDate)}
            </div>
            <div
              className={`text-[11px] font-bold ${
                isOverdue || isToday
                  ? 'text-red-600'
                  : isSoon
                  ? 'text-amber-600'
                  : 'text-slate-500'
              }`}
            >
              {formatRelativeDays(reminder.daysLeft)}
            </div>
          </div>

          <div className="flex shrink-0">
            {isOverdue && (
              <span className="px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                Po termínu
              </span>
            )}
            {isToday && (
              <span className="px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                Dnes
              </span>
            )}
            {isSoon && (
              <span className="px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                Brzy
              </span>
            )}
            {reminder.status === 'later' && (
              <span className="px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                Později
              </span>
            )}
          </div>

          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-slate-900 leading-tight">
                Blížící se termíny
              </h3>
              <p className="text-xs text-slate-500">
                Přehled termínů a lhůt u evidovaných položek
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Zavřít dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Controls Toolbar */}
        <div className="px-5 sm:px-6 py-3 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          {/* Scope Segmented Control */}
          <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setScope('all')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                scope === 'all'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Všechny sekce
            </button>
            <button
              type="button"
              onClick={() => setScope('current')}
              disabled={!activeCollection}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                scope === 'current'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 disabled:opacity-40'
              }`}
            >
              Jen tato sekce
            </button>
          </div>

          {/* Toggle: Zobrazit i pozdější termíny */}
          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 select-none">
            <input
              type="checkbox"
              checked={showLater}
              onChange={(e) => setShowLater(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
            />
            <span>Zobrazit i pozdější termíny</span>
          </label>
        </div>

        {/* Content list */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 grow">
          {filteredReminders.length === 0 ? (
            <div className="text-center py-12 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs sm:text-sm font-semibold text-slate-700 max-w-sm mx-auto leading-relaxed">
                Žádné blížící se termíny. Zapněte upozornění u polí typu datum v
                nastavení vlastností.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Group: Po termínu */}
              {overdueGroup.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <h4 className="text-xs font-bold text-red-700 uppercase tracking-wide">
                      Po termínu ({overdueGroup.length})
                    </h4>
                  </div>
                  <div className="space-y-1.5">
                    {overdueGroup.map(renderReminderRow)}
                  </div>
                </div>
              )}

              {/* Group: Dnes */}
              {todayGroup.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-red-600" />
                    <h4 className="text-xs font-bold text-red-700 uppercase tracking-wide">
                      Dnes ({todayGroup.length})
                    </h4>
                  </div>
                  <div className="space-y-1.5">
                    {todayGroup.map(renderReminderRow)}
                  </div>
                </div>
              )}

              {/* Group: Brzy */}
              {soonGroup.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                      Brzy ({soonGroup.length})
                    </h4>
                  </div>
                  <div className="space-y-1.5">
                    {soonGroup.map(renderReminderRow)}
                  </div>
                </div>
              )}

              {/* Group: Později */}
              {showLater && laterGroup.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                      Později ({laterGroup.length})
                    </h4>
                  </div>
                  <div className="space-y-1.5">
                    {laterGroup.map(renderReminderRow)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
};
