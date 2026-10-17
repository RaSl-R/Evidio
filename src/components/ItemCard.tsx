import React from 'react';
import { Item, FieldDefinition, ItemEvent, Attachment, Tag, ItemDetailFocus } from '../types';
import { Edit2, Trash2, Bell } from 'lucide-react';
import { useAttachmentUrl } from '../hooks/useAttachmentUrl';
import { getTagColorOption } from '../utils/tagColors';
import {
  ReminderItem,
  formatRelativeDays,
  selectItemReminderChips,
  getReminderFocusTarget,
} from '../utils/reminders';
import {
  formatCompactFieldValue,
  formatDateLabel,
  getEventCountText,
  getRemainingFieldsText,
  sortEventsDesc,
} from '../utils/itemHelpers';

interface ItemCardProps {
  item: Item;
  fields: FieldDefinition[];
  events?: ItemEvent[];
  mainPhoto?: Attachment | null;
  tags?: Tag[];
  urgentReminder?: ReminderItem | null;
  totalRemindersCount?: number;
  itemReminders?: ReminderItem[];
  onOpenDetail: (item: Item, focus?: ItemDetailFocus) => void;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({
  item,
  fields,
  events = [],
  mainPhoto,
  tags = [],
  urgentReminder,
  totalRemindersCount,
  itemReminders = [],
  onOpenDetail,
  onEdit,
  onDelete,
}) => {
  const activeFields = fields.filter((f) => f.target === 'ITEM' && !f.is_archived);
  const populatedFields = activeFields.filter((f) => {
    const val = item.data?.[f.id];
    return val !== undefined && val !== null && val !== '';
  });
  const displayedFields = populatedFields.slice(0, 3);
  const remainingFieldCount = populatedFields.length - 3;

  const coverUrl = useAttachmentUrl(mainPhoto?.blob);

  // Resolved tags for this item
  const itemTags = tags.filter((t) => item.tag_ids?.includes(t.id));
  const displayedTags = itemTags.slice(0, 3);
  const remainingTagCount = itemTags.length - 3;

  // Determine event count and most recent event date
  const eventCount = events.length;
  const sortedEvents = sortEventsDesc(events);
  const latestEvent = sortedEvents[0];

  const remindersToUse =
    itemReminders && itemReminders.length > 0
      ? itemReminders
      : urgentReminder
      ? [urgentReminder]
      : [];

  const normalChips = selectItemReminderChips(remindersToUse, 2);
  const narrowChips = selectItemReminderChips(remindersToUse, 1);

  const renderReminderChip = (r: ReminderItem) => {
    const focus = getReminderFocusTarget(r);
    const isOverdueOrToday = r.status === 'overdue' || r.status === 'today';
    const isSoon = r.status === 'soon';
    const tooltipText = `${r.fieldName}: ${formatDateLabel(r.dueDate)}${
      r.dueTime ? ` · ${r.dueTime}` : ''
    } (${formatRelativeDays(r.daysLeft)})`;
    const ariaLabel = `Otevřít detail položky na ${
      r.targetKind === 'EVENT' ? 'události' : 'vlastnosti'
    }: ${r.fieldName}, ${formatRelativeDays(r.daysLeft)}`;

    return (
      <button
        key={`${r.fieldId}-${r.dueDate}`}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenDetail(item, focus);
        }}
        title={tooltipText}
        aria-label={ariaLabel}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border min-w-0 shrink cursor-pointer transition-colors ${
          isOverdueOrToday
            ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
            : isSoon
            ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
        }`}
        style={{ minWidth: 0 }}
      >
        <Bell className="w-2.5 h-2.5 shrink-0" />
        <span className="truncate min-w-0">
          {r.fieldName}
        </span>
        <span className="shrink-0 whitespace-nowrap">
          : {formatRelativeDays(r.daysLeft)}
        </span>
      </button>
    );
  };

  const renderPlusButton = (hiddenCount: number, nextHidden: ReminderItem | null) => {
    if (hiddenCount <= 0 || !nextHidden) return null;
    const focus = getReminderFocusTarget(nextHidden);
    const nextTooltipDate = `${formatDateLabel(nextHidden.dueDate)}${
      nextHidden.dueTime ? ` · ${nextHidden.dueTime}` : ''
    }`;
    const ariaLabel = `Otevřít detail položky na dalším termínu: ${nextHidden.fieldName}, ${formatRelativeDays(
      nextHidden.daysLeft
    )}`;

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenDetail(item, focus);
        }}
        title={`+${hiddenCount} dalších termínů (${nextHidden.fieldName}: ${nextTooltipDate})`}
        aria-label={ariaLabel}
        className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 shrink-0 cursor-pointer transition-colors"
      >
        +{hiddenCount}
      </button>
    );
  };

  return (
    <div
      onClick={() => onOpenDetail(item)}
      style={{ containerType: 'inline-size' }}
      className="@container bg-white rounded-2xl border border-slate-200/90 hover:border-indigo-300 shadow-2xs hover:shadow-xs transition-all p-3 sm:p-3.5 flex flex-col justify-between group cursor-pointer overflow-hidden"
    >
      <div>
        {/* Header: Thumbnail (if any) + Title & Actions + Tags */}
        <div className="flex items-start gap-3">
          {coverUrl && (
            <img
              src={coverUrl}
              alt={item.name}
              className="w-[72px] h-[72px] rounded-xl object-cover shrink-0 border border-slate-100"
            />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-1.5">
              <h3 className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug line-clamp-2 break-words">
                {item.name}
              </h3>

              {/* Icon Action Buttons */}
              <div className="flex items-center gap-0.5 shrink-0 -mr-1 -mt-0.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(item);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                  title="Upravit"
                  aria-label="Upravit"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                  title="Smazat"
                  aria-label="Smazat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Tag Chips (max 3, then +N) */}
            {itemTags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap mt-1.5">
                {displayedTags.map((tag) => {
                  const opt = getTagColorOption(tag.color);
                  return (
                    <span
                      key={tag.id}
                      className={`inline-flex items-center px-1.5 py-0.2 rounded-md text-[10px] font-semibold border ${
                        opt
                          ? `${opt.bgClass} ${opt.textClass} ${opt.borderClass}`
                          : ''
                      }`}
                      style={
                        !opt
                          ? {
                              backgroundColor: `${tag.color}15`,
                              color: tag.color,
                              borderColor: `${tag.color}35`,
                            }
                          : undefined
                      }
                    >
                      {tag.name}
                    </span>
                  );
                })}
                {remainingTagCount > 0 && (
                  <span
                    className="inline-flex items-center px-1 py-0.2 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200"
                    title={`+${remainingTagCount} dalších štítků`}
                  >
                    +{remainingTagCount}
                  </span>
                )}
              </div>
            )}

            {/* Urgent Reminder Status Chips (Container-query responsive) */}
            {normalChips.totalUrgentCount > 0 && (
              <>
                {normalChips.totalUrgentCount === 1 ? (
                  <div className="flex items-center gap-1.5 flex-nowrap overflow-hidden mt-1.5 max-w-full">
                    {renderReminderChip(normalChips.visibleReminders[0])}
                  </div>
                ) : (
                  <>
                    {/* Normal container (>=240px): up to 2 chips + "+N" */}
                    <div className="cq-chips-normal flex items-center gap-1.5 flex-nowrap overflow-hidden mt-1.5 max-w-full">
                      {normalChips.visibleReminders.map((r) => renderReminderChip(r))}
                      {renderPlusButton(normalChips.hiddenCount, normalChips.nextHiddenReminder)}
                    </div>

                    {/* Narrow container (<240px): 1 chip + "+N" */}
                    <div className="cq-chips-narrow flex items-center gap-1.5 flex-nowrap overflow-hidden mt-1.5 max-w-full">
                      {narrowChips.visibleReminders.map((r) => renderReminderChip(r))}
                      {renderPlusButton(narrowChips.hiddenCount, narrowChips.nextHiddenReminder)}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Compact Two-Column Fields (at most first 3 active fields) */}
        {displayedFields.length > 0 && (
          <div className="mt-2.5 pt-2 border-t border-slate-100">
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
              {displayedFields.map((field) => {
                const rawVal = item.data?.[field.id];
                return (
                  <div key={field.id} className="min-w-0 truncate text-slate-600">
                    <span className="text-slate-400 font-medium">{field.name}: </span>
                    <span className="font-semibold text-slate-700">
                      {formatCompactFieldValue(field, rawVal)}
                    </span>
                  </div>
                );
              })}
            </div>
            {remainingFieldCount > 0 && (
              <div className="text-[11px] text-slate-400 mt-1">
                {getRemainingFieldsText(remainingFieldCount)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer: one muted line with event count and date, or "Bez událostí" */}
      <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] sm:text-xs text-slate-400 truncate">
        {eventCount > 0 && latestEvent ? (
          <>
            {getEventCountText(eventCount)} · poslední{' '}
            {formatDateLabel(latestEvent.event_date)}
          </>
        ) : (
          'Bez událostí'
        )}
      </div>
    </div>
  );
};
