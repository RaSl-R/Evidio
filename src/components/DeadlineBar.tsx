import React, { useState, useMemo, useEffect } from 'react';
import {
  ReminderItem,
  selectDeadlineBarReminders,
  getDeadlineBarColorLevel,
  formatDeadlineBarSegment,
} from '../utils/reminders';
import {
  getDismissedDeadlineBarKeys,
  dismissDeadlineBarReminder,
} from '../utils/deadlineBarStorage';
import { Item } from '../types';
import { AlertCircle, AlertTriangle, Clock, X } from 'lucide-react';

export interface DeadlineBarProps {
  reminders: ReminderItem[];
  items: Item[];
  todayStr: string;
  onSelectReminder: (reminder: ReminderItem) => void;
  onOpenAllReminders: () => void;
}

export const DeadlineBar: React.FC<DeadlineBarProps> = ({
  reminders,
  items,
  todayStr,
  onSelectReminder,
  onOpenAllReminders,
}) => {
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() =>
    getDismissedDeadlineBarKeys(todayStr)
  );

  useEffect(() => {
    setDismissedKeys(getDismissedDeadlineBarKeys(todayStr));
  }, [todayStr]);

  const { shownReminders, remainingCount } = useMemo(
    () => selectDeadlineBarReminders(reminders, dismissedKeys, 2, todayStr),
    [reminders, dismissedKeys, todayStr]
  );

  const itemsById = useMemo(() => {
    const map = new Map<string, Item>();
    for (const item of items) {
      map.set(item.id, item);
    }
    return map;
  }, [items]);

  const handleDismissBar = (reminder: ReminderItem) => {
    const updatedKeys = dismissDeadlineBarReminder(reminder, todayStr);
    setDismissedKeys(new Set(updatedKeys));
  };

  if (shownReminders.length === 0) {
    return null;
  }

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center gap-2 w-full text-xs"
      role="region"
      aria-label="Blížící se termíny"
    >
      {/* Bars container: stacked full width below 640px, flex row above */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 min-w-0 w-full">
        {shownReminders.map((r) => {
          const item = itemsById.get(r.itemId);
          const seg = formatDeadlineBarSegment(r, item?.name);
          const key = r.eventId ? `${r.itemId}:${r.eventId}` : `${r.itemId}:${r.fieldId}`;
          const colorLevel = getDeadlineBarColorLevel(r);

          let containerColorClasses = '';
          let iconElement: React.ReactNode = null;

          if (colorLevel === 'red') {
            containerColorClasses = 'bg-red-50 text-red-950 border-red-200/80 hover:bg-red-100/80';
            iconElement = <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />;
          } else if (colorLevel === 'orange') {
            containerColorClasses = 'bg-orange-50 text-orange-950 border-orange-200/80 hover:bg-orange-100/80';
            iconElement = <AlertTriangle className="w-3.5 h-3.5 text-orange-600 shrink-0" />;
          } else {
            // yellow
            containerColorClasses = 'bg-amber-50 text-amber-950 border-amber-200/80 hover:bg-amber-100/80';
            iconElement = <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />;
          }

          return (
            <div
              key={key}
              className={`flex items-center justify-between gap-1.5 px-3 py-1.5 rounded-xl border transition-all flex-1 min-w-0 w-full ${containerColorClasses}`}
            >
              {/* Main button to select/open reminder */}
              <button
                type="button"
                onClick={() => onSelectReminder(r)}
                className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer group py-0.5"
                title={seg.fullText}
              >
                {iconElement}
                <span className="truncate min-w-0 font-medium">{seg.labelPart}</span>
                <span className="whitespace-nowrap shrink-0 font-semibold">{seg.relativePart}</span>
              </button>

              {/* Sibling dismiss button */}
              <button
                type="button"
                onClick={() => handleDismissBar(r)}
                className="p-1 hover:bg-black/10 rounded-lg text-current opacity-60 hover:opacity-100 cursor-pointer shrink-0"
                title={`Skrýt upozornění do konce dne: ${r.fieldName}`}
                aria-label={`Skrýt upozornění do konce dne: ${r.fieldName}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Compact +N button when more not-dismissed urgent reminders exist */}
      {remainingCount > 0 && (
        <button
          type="button"
          onClick={onOpenAllReminders}
          className="self-end sm:self-auto shrink-0 inline-flex items-center justify-center px-2 py-1.5 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200/80 transition-colors cursor-pointer whitespace-nowrap shadow-xs"
          aria-label="Zobrazit všechny termíny"
          title="Zobrazit všechny termíny"
        >
          +{remainingCount}
        </button>
      )}
    </div>
  );
};
