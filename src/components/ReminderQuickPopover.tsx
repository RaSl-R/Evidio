import React, { useState, useEffect, useRef } from 'react';
import { FieldDefinition } from '../types';
import { db } from '../db';
import { ReminderConfigEditor } from './ReminderConfigEditor';
import { Bell, BellOff, X } from 'lucide-react';

interface ReminderQuickPopoverProps {
  field: FieldDefinition;
  scopeNote: string;
  onOpenFieldEdit: (field: FieldDefinition) => void;
}

export const ReminderQuickPopover: React.FC<ReminderQuickPopoverProps> = ({
  field,
  scopeNote,
  onOpenFieldEdit,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isEnabled = Boolean(field.config?.reminder?.enabled);
  const daysBefore = field.config?.reminder?.days_before ?? 30;

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

  const handleToggle = async (newEnabled: boolean) => {
    const curConfig = field.config || {};
    const updatedConfig = {
      ...curConfig,
      reminder: {
        enabled: newEnabled,
        days_before: daysBefore,
      },
    };
    await db.field_definitions.update(field.id, {
      config: updatedConfig,
      updated_at: new Date().toISOString(),
    });
  };

  const handleChangeDays = async (newDays: number) => {
    const curConfig = field.config || {};
    const updatedConfig = {
      ...curConfig,
      reminder: {
        enabled: isEnabled,
        days_before: newDays,
      },
    };
    await db.field_definitions.update(field.id, {
      config: updatedConfig,
      updated_at: new Date().toISOString(),
    });
  };

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      {/* Bell chip */}
      {isEnabled ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer shadow-2xs ${
            isOpen ? 'ring-2 ring-indigo-400' : ''
          }`}
          title={`Upozornění: ${daysBefore} d předem (kliknutím upravíte)`}
          aria-label={`Upozornění: ${daysBefore} dní`}
        >
          <Bell className="w-3 h-3 text-indigo-600 shrink-0" />
          <span>{daysBefore} d</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }}
          className={`inline-flex items-center justify-center p-1 rounded-md text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200/80 border border-slate-200/60 transition-colors cursor-pointer ${
            isOpen ? 'ring-2 ring-indigo-400' : ''
          }`}
          title="Upozornění na termín vypnuto (kliknutím zapnete)"
          aria-label="Zapnout upozornění na termín"
        >
          <BellOff className="w-3 h-3 text-slate-400 shrink-0" />
        </button>
      )}

      {/* Popover */}
      {isOpen && (
        <div
          className="absolute left-0 top-full mt-1.5 z-40 w-72 max-w-[calc(100vw-3.5rem)] bg-white rounded-2xl shadow-xl border border-slate-200 p-3.5 space-y-3 animate-in fade-in zoom-in-95 duration-100 text-slate-800"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-xs font-bold text-slate-900">Upozornění na termín</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
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

          <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-xl border border-slate-100 leading-relaxed">
            💡 {scopeNote}
          </div>

          <div className="pt-1 flex items-center justify-between border-t border-slate-100 text-xs">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenFieldEdit(field);
              }}
              className="font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
            >
              Další nastavení…
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-500 hover:text-slate-700 font-medium px-2 py-0.5 rounded cursor-pointer"
            >
              Hotovo
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
