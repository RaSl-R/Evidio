import React, { useState, useRef, useEffect } from 'react';
import { Collection, CollectionGroup, Item } from '../types';
import { ReminderItem } from '../utils/reminders';
import { DeadlineBar } from './DeadlineBar';
import {
  Box,
  Plus,
  FolderKanban,
  Upload,
  Download,
  ShieldCheck,
  AlertTriangle,
  X,
  Database,
  ChevronDown,
  Bell,
} from 'lucide-react';

interface NavbarProps {
  visibleGroups: CollectionGroup[];
  activeGroupId: string | null;
  onSelectGroup: (groupId: string) => void;
  filteredCollections: Collection[];
  activeCollection: Collection | null;
  onSelectCollection: (collection: Collection) => void;
  onOpenCreateCollection: () => void;
  onOpenCategoryManager: () => void;
  onOpenImport: () => void;
  onExportAll: () => void;
  lastBackupDate: string | null;
  onOpenReminders: () => void;
  remindersCount: number;
  hasOverdueOrToday: boolean;
  hasSoon: boolean;
  urgentReminders: ReminderItem[];
  allItems: Item[];
  todayStr: string;
  onSelectReminder: (reminder: ReminderItem) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  visibleGroups,
  activeGroupId,
  onSelectGroup,
  filteredCollections,
  activeCollection,
  onSelectCollection,
  onOpenCreateCollection,
  onOpenCategoryManager,
  onOpenImport,
  onExportAll,
  lastBackupDate,
  onOpenReminders,
  remindersCount,
  hasOverdueOrToday,
  hasSoon,
  urgentReminders,
  allItems,
  todayStr,
  onSelectReminder,
}) => {
  const [isBackupDismissed, setIsBackupDismissed] = useState(false);
  const [isDataMenuOpen, setIsDataMenuOpen] = useState(false);
  const dataMenuRef = useRef<HTMLDivElement>(null);
  const showCategoryRow = visibleGroups.length >= 2;

  // Handle click outside to close "Záloha a data" menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dataMenuRef.current && !dataMenuRef.current.contains(e.target as Node)) {
        setIsDataMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDataMenuOpen(false);
      }
    };
    if (isDataMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDataMenuOpen]);

  // Calculate backup status
  let backupStatus = {
    isOldOrNever: true,
    formattedText: 'Zatím neproběhla žádná záloha',
    reminderText: 'Doporučujeme provést zálohu',
  };

  if (lastBackupDate) {
    try {
      const d = new Date(lastBackupDate);
      const diffMs = Date.now() - d.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const formattedDate = d.toLocaleDateString('cs-CZ', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
      });

      if (diffDays > 30) {
        backupStatus = {
          isOldOrNever: true,
          formattedText: `Poslední záloha: ${formattedDate}`,
          reminderText: `před ${diffDays} dny — doporučujeme zálohovat`,
        };
      } else {
        backupStatus = {
          isOldOrNever: false,
          formattedText: `Poslední záloha: ${formattedDate}`,
          reminderText: '',
        };
      }
    } catch {
      // keep fallback
    }
  }

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 space-y-2 sm:space-y-2.5">
        {/* Top App Branding & "Záloha a data" Menu */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-xs shrink-0">
              <Box className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900">
                  Evidio
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 uppercase tracking-wide truncate">
                  Osobní inventář
                </span>
              </div>
            </div>
          </div>

          {/* Right Header Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* "Termíny" Button with Bell */}
            <button
              type="button"
              onClick={onOpenReminders}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/70 text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0"
              title="Blížící se termíny"
              aria-label={
                remindersCount > 0
                  ? `Termíny: ${remindersCount} aktivních upozornění${
                      hasOverdueOrToday ? ' (po termínu či dnes)' : ' (blíží se)'
                    }`
                  : 'Termíny: žádná aktivní upozornění'
              }
            >
              <Bell className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>Termíny</span>
              {remindersCount > 0 && (
                <span
                  className={`inline-flex items-center justify-center min-w-4 px-1.5 py-0.2 rounded-full text-[10px] font-bold shrink-0 ${
                    hasOverdueOrToday
                      ? 'bg-red-600 text-white'
                      : 'bg-amber-500 text-white'
                  }`}
                >
                  {remindersCount}
                </span>
              )}
            </button>

            {/* "Záloha a data" Menu */}
            <div className="relative shrink-0" ref={dataMenuRef}>
              <button
                type="button"
                onClick={() => setIsDataMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/70 text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                title="Záloha a data aplikace"
                aria-label="Záloha a data"
              >
                <Database className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>Záloha a data</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isDataMenuOpen ? 'rotate-180' : ''}`} />
              </button>

            {isDataMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-2xl shadow-xl border border-slate-200/80 p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                {/* Backup status header section */}
                <div className="px-3 py-2.5 bg-slate-50 rounded-xl mb-1.5 border border-slate-100">
                  <div className="flex items-center gap-2 mb-1">
                    {backupStatus.isOldOrNever ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    )}
                    <span className="text-xs font-bold text-slate-800">
                      Stav zálohy
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-tight">
                    {backupStatus.formattedText}
                  </p>
                  {backupStatus.reminderText && (
                    <p className="text-[10px] text-amber-700 font-medium mt-0.5">
                      {backupStatus.reminderText}
                    </p>
                  )}
                </div>

                {/* Exportovat vše */}
                <button
                  type="button"
                  onClick={() => {
                    setIsDataMenuOpen(false);
                    onExportAll();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-indigo-50/70 transition-colors cursor-pointer group"
                >
                  <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors shrink-0">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">Exportovat vše</div>
                    <div className="text-[10px] text-slate-500">Kompletní záloha JSON</div>
                  </div>
                </button>

                {/* Importovat */}
                <button
                  type="button"
                  onClick={() => {
                    setIsDataMenuOpen(false);
                    onOpenImport();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-slate-200 transition-colors shrink-0">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">Importovat</div>
                    <div className="text-[10px] text-slate-500">Obnovit nebo přidat kopii</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

        {/* DEADLINE BAR: compact bar directly under header and ABOVE backup note */}
        <DeadlineBar
          reminders={urgentReminders}
          items={allItems}
          todayStr={todayStr}
          onSelectReminder={onSelectReminder}
          onOpenAllReminders={onOpenReminders}
        />

        {/* Backup Reminder (small dismissible note) */}
        {!isBackupDismissed && (
          <div
            className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl text-xs border transition-all ${
              backupStatus.isOldOrNever
                ? 'bg-amber-50 text-amber-900 border-amber-200/80'
                : 'bg-slate-50 text-slate-700 border-slate-200/80'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {backupStatus.isOldOrNever ? (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              )}
              <span className="truncate">
                <strong>{backupStatus.formattedText}</strong>
                {backupStatus.reminderText && (
                  <span className="ml-1 opacity-80">({backupStatus.reminderText})</span>
                )}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsBackupDismissed(true)}
              className="p-1 hover:bg-black/5 rounded-lg text-current opacity-60 hover:opacity-100 cursor-pointer shrink-0"
              title="Skrýt upozornění"
              aria-label="Skrýt upozornění"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Row 1: Category chips (only rendered when 2+ groups are visible) */}
        {showCategoryRow && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 scroll-smooth max-w-full">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
              <FolderKanban className="w-3.5 h-3.5 text-slate-400" />
              Kategorie:
            </span>
            {visibleGroups.map((group) => {
              const isActive = activeGroupId === group.id;
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => onSelectGroup(group.id)}
                  className={`shrink-0 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs scale-[1.02]'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200/60'
                  }`}
                >
                  {group.name}
                </button>
              );
            })}

            {/* Správa kategorií button at the END of the category bar, right after the category chips */}
            <button
              type="button"
              onClick={onOpenCategoryManager}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200/60 text-xs font-bold transition-all cursor-pointer ml-1"
              title="Správa kategorií"
              aria-label="Správa kategorií"
            >
              <FolderKanban className="w-3.5 h-3.5 text-slate-500" />
              <span>Správa kategorií</span>
            </button>
          </div>
        )}

        {/* Row 2: Section Switcher Tabs & "+ Nová sekce" */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 scroll-smooth max-w-full">
          {filteredCollections.map((col) => {
            const isActive = activeCollection?.id === col.id;
            return (
              <button
                key={col.id}
                type="button"
                onClick={() => onSelectCollection(col)}
                className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 scale-[1.02]'
                    : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 hover:text-slate-900 border border-slate-200/60'
                }`}
              >
                <span>{col.name}</span>
              </button>
            );
          })}

          {filteredCollections.length === 0 && (
            <span className="text-xs text-slate-500 italic shrink-0 py-1 px-2">
              Žádné sekce v této kategorii
            </span>
          )}

          {/* Prominent "+ Nová sekce" Button */}
          <button
            type="button"
            onClick={onOpenCreateCollection}
            className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/60 text-sm font-bold transition-all hover:scale-[1.02] cursor-pointer"
            title="Vytvořit novou sekci v této kategorii"
            aria-label="Vytvořit novou sekci"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline">Nová sekce</span>
          </button>

          {/* When the category bar is hidden (only one visible category), keep a small button in the section row labeled "Seskupit do kategorií".
              When the bar is visible (2+ visible categories), this button is removed. */}
          {!showCategoryRow && (
            <button
              type="button"
              onClick={onOpenCategoryManager}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/60 text-xs font-bold transition-all hover:text-slate-900 cursor-pointer"
              title="Seskupit sekce do kategorií"
              aria-label="Seskupit do kategorií"
            >
              <FolderKanban className="w-3.5 h-3.5 text-slate-500" />
              <span>Seskupit do kategorií</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
