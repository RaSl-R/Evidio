import React, { useState, useMemo, useEffect } from 'react';
import {
  ReminderItem,
  selectDeadlineBarReminders,
  getDeadlineBarColorLevel,
  formatDeadlineBarSegment,
  getDeadlineBarDismissKey,
  isDeadlineBarDismissed,
  dismissDeadlineBar,
} from '../utils/reminders';
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
  const { shownReminders, totalUrgentCount, remainingCount } = useMemo(
    () => selectDeadlineBarReminders(reminders),
    [reminders]
  );

  const dismissKey = useMemo(
    () => getDeadlineBarDismissKey(todayStr, shownReminders),
    [todayStr, shownReminders]
  );

  const [isDismissed, setIsDismissed] = useState<boolean>(() =>
    isDeadlineBarDismissed(todayStr, shownReminders)
  );

  useEffect(() => {
    setIsDismissed(isDeadlineBarDismissed(todayStr, shownReminders));
  }, [dismissKey, todayStr, shownReminders]);

  const handleDismiss = () => {
    dismissDeadlineBar(todayStr, shownReminders);
    setIsDismissed(true);
  };

  const itemsById = useMemo(() => {
    const map = new Map<string, Item>();
    for (const item of items) {
      map.set(item.id, item);
    }
    return map;
  }, [items]);

  if (totalUrgentCount === 0 || shownReminders.length === 0 || isDismissed) {
    return null;
  }

  // Color level is determined by the most urgent shown reminder (shownReminders[0])
  const colorLevel = getDeadlineBarColorLevel(shownReminders[0]);

  let containerColorClasses = '';
  let iconElement: React.ReactNode = null;

  if (colorLevel === 'red') {
    containerColorClasses = 'bg-red-50 text-red-950 border-red-200/80';
    iconElement = <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />;
  } else if (colorLevel === 'orange') {
    containerColorClasses = 'bg-orange-50 text-orange-950 border-orange-200/80';
    iconElement = <AlertTriangle className="w-3.5 h-3.5 text-orange-600 shrink-0" />;
  } else {
    // yellow
    containerColorClasses = 'bg-amber-50 text-amber-950 border-amber-200/80';
    iconElement = <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />;
  }

  return (
    <div
      className={`flex items-start sm:items-center justify-between gap-2 px-3 py-1.5 rounded-xl text-xs border transition-all ${containerColorClasses}`}
      role="region"
      aria-label="Blížící se termíny"
    >
      {/* Icon & Clickable Segments */}
      <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
        <div className="mt-0.5 sm:mt-0 shrink-0">
          {iconElement}
        </div>

        {/* Segments: side-by-side on wide screens, stacked on 380px mobile screens */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2.5 min-w-0 flex-1">
          {shownReminders.map((r, idx) => {
            const item = itemsById.get(r.itemId);
            const seg = formatDeadlineBarSegment(r, item?.name);
            const key = r.eventId ? `${r.itemId}:${r.eventId}` : `${r.itemId}:${r.fieldId}`;

            return (
              <React.Fragment key={key}>
                {idx > 0 && (
                  <span className="hidden sm:inline opacity-30 select-none">•</span>
                )}
                <button
                  type="button"
                  onClick={() => onSelectReminder(r)}
                  className="flex items-center min-w-0 text-left hover:underline cursor-pointer group py-0.5"
                  title={seg.fullText}
                >
                  <span className="truncate min-w-0 font-medium">{seg.labelPart}</span>
                  <span className="whitespace-nowrap shrink-0 ml-1 font-semibold">{seg.relativePart}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Action buttons: +N (if > 2 reminders exist) and Dismiss (X) */}
      <div className="flex items-center gap-1 shrink-0 mt-0.5 sm:mt-0">
        {remainingCount > 0 && (
          <button
            type="button"
            onClick={onOpenAllReminders}
            className="px-1.5 py-0.5 rounded-lg bg-black/5 hover:bg-black/10 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
            aria-label={`Zobrazit všechny termíny (celkem ${totalUrgentCount})`}
            title={`Zobrazit všechny termíny (celkem ${totalUrgentCount})`}
          >
            +{remainingCount}
          </button>
        )}
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 hover:bg-black/5 rounded-lg text-current opacity-60 hover:opacity-100 cursor-pointer shrink-0"
          title="Skrýt upozornění"
          aria-label="Skrýt upozornění"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
