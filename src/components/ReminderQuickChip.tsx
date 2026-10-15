import React, { useState, useRef, useEffect } from 'react';
import { Bell, BellOff, X, ExternalLink } from 'lucide-react';
import { FieldDefinition, FieldConfig } from '../types';
import { db } from '../db';
import { ReminderConfigEditor } from './ReminderConfigEditor';

interface ReminderQuickChipProps {
  field: FieldDefinition;
  collectionName: string;
  onOpenFieldEdit: () => void;
}

export const ReminderQuickChip: React.FC<ReminderQuickChipProps> = ({
  field,
  collectionName,
  onOpenFieldEdit,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isEnabled = Boolean(field.config?.reminder?.enabled);
  const daysBefore = field.config?.reminder?.days_before ?? 30;

  // Handle click outside & escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleToggle = async (enabled: boolean) => {
    const updatedConfig: FieldConfig = {
      ...field.config,
      reminder: {
        enabled,
        days_before: field.config?.reminder?.days_before ?? 30,
      },
    };

    await db.field_definitions.update(field.id, {
      config: updatedConfig,
      updated_at: new Date().toISOString(),
    });
  };

  const handleChangeDays = async (days: number) => {
    const updatedConfig: FieldConfig = {
      ...field.config,
      reminder: {
        enabled: field.config?.reminder?.enabled ?? true,
        days_before: days,
      },
    };

    await db.field_definitions.update(field.id, {
      config: updatedConfig,
      updated_at: new Date().toISOString(),
    });
  };

  const scopeNote =
    field.target === 'EVENT'
      ? `Platí pro všechny události v sekci ${collectionName}`
      : `Platí pro všechny položky v sekci ${collectionName}`;

  return (
    <div className="relative inline-flex items-center" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
          isEnabled
            ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200/80 shadow-2xs'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 border-slate-200/80'
        }`}
        title={
          isEnabled
            ? `Upozornění na termín: ${daysBefore} dní předem (klikněte pro úpravu)`
            : 'Upozornění na termín je vypnuto (klikněte pro nastavení)'
        }
        aria-label={
          isEnabled
            ? `Upozornění ${daysBefore} dní předem`
            : 'Upozornění na termín vypnuto'
        }
        aria-expanded={isOpen}
      >
        {isEnabled ? (
          <>
            <Bell className="w-3 h-3 text-indigo-600 shrink-0" />
            <span>{daysBefore} d</span>
          </>
        ) : (
          <BellOff className="w-3 h-3 text-slate-400 shrink-0" />
        )}
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 z-40 w-72 max-w-[calc(100vw-3rem)] bg-white rounded-2xl shadow-xl border border-slate-200/90 p-3.5 space-y-3 animate-in fade-in zoom-in-95 text-left">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-800">
              Upozornění na termín
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
              title="Zavřít"
              aria-label="Zavřít"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <ReminderConfigEditor
            enabled={isEnabled}
            daysBefore={daysBefore}
            onToggle={handleToggle}
            onChangeDaysBefore={handleChangeDays}
          />

          <div className="pt-2 border-t border-slate-100 space-y-2">
            <p className="text-[11px] text-slate-500 leading-snug">
              {scopeNote}
            </p>

            <div className="flex items-center justify-between pt-0.5">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenFieldEdit();
                }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
              >
                <span>Další nastavení…</span>
                <ExternalLink className="w-3 h-3" />
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Hotovo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
