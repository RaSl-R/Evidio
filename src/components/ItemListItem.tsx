import React from 'react';
import { Item, FieldDefinition, ItemEvent, Attachment, Tag } from '../types';
import { Edit2, Trash2, Bell } from 'lucide-react';
import { useAttachmentUrl } from '../hooks/useAttachmentUrl';
import { getTagColorOption } from '../utils/tagColors';
import { ReminderItem, formatRelativeDays } from '../utils/reminders';
import {
  formatCompactFieldValue,
  formatDateLabel,
  getEventCountText,
  sortEventsDesc,
} from '../utils/itemHelpers';

interface ItemListItemProps {
  item: Item;
  fields: FieldDefinition[];
  events?: ItemEvent[];
  mainPhoto?: Attachment | null;
  tags?: Tag[];
  urgentReminder?: ReminderItem | null;
  totalRemindersCount?: number;
  onOpenDetail: (item: Item) => void;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
}

export const ItemListItem: React.FC<ItemListItemProps> = ({
  item,
  fields,
  events = [],
  mainPhoto,
  tags = [],
  urgentReminder,
  totalRemindersCount,
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

  const coverUrl = useAttachmentUrl(mainPhoto?.blob);

  // Resolved tags for this item
  const itemTags = tags.filter((t) => item.tag_ids?.includes(t.id));
  const displayedTags = itemTags.slice(0, 2);
  const remainingTagCount = itemTags.length - 2;

  // Determine event count
  const eventCount = events.length;
  const sortedEvents = sortEventsDesc(events);
  const latestEvent = sortedEvents[0];

  return (
    <div
      onClick={() => onOpenDetail(item)}
      className="bg-white rounded-xl border border-slate-200/90 hover:border-indigo-300 shadow-2xs hover:shadow-xs transition-all px-3 sm:px-4 py-2 min-h-[56px] sm:h-14 flex items-center justify-between gap-2.5 sm:gap-3 group cursor-pointer overflow-hidden"
    >
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
        {/* Small thumbnail or none */}
        {coverUrl && (
          <img
            src={coverUrl}
            alt={item.name}
            className="w-10 h-10 rounded-lg object-cover shrink-0 border border-slate-100"
          />
        )}

        {/* Mobile Layout (< md): 1 line name with reminder chip, 2nd line up to 2 values */}
        <div className="min-w-0 flex-1 md:hidden">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
              {item.name}
            </span>
            {urgentReminder && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-[9px] font-bold border shrink-0 ${
                  urgentReminder.status === 'overdue' || urgentReminder.status === 'today'
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : urgentReminder.status === 'soon'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
                title={`${urgentReminder.fieldName}: ${formatRelativeDays(urgentReminder.daysLeft)}`}
              >
                <Bell className="w-2 h-2 shrink-0" />
                <span className="truncate max-w-[120px]">
                  {urgentReminder.fieldName}: {formatRelativeDays(urgentReminder.daysLeft)}
                </span>
                {totalRemindersCount && totalRemindersCount > 1 && (
                  <span>+{totalRemindersCount - 1}</span>
                )}
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
            {displayedFields.length > 0 ? (
              displayedFields.slice(0, 2).map((field, idx) => (
                <React.Fragment key={field.id}>
                  {idx > 0 && <span className="text-slate-300 font-normal">·</span>}
                  <span className="truncate">
                    <span className="text-slate-400 font-normal">{field.name}: </span>
                    <span className="font-medium text-slate-700">
                      {formatCompactFieldValue(field, item.data?.[field.id])}
                    </span>
                  </span>
                </React.Fragment>
              ))
            ) : itemTags.length > 0 ? (
              <span className="truncate">
                {itemTags.slice(0, 2).map((t) => t.name).join(', ')}
              </span>
            ) : (
              <span className="text-slate-400">
                {eventCount > 0 ? getEventCountText(eventCount) : 'Bez událostí'}
              </span>
            )}
          </div>
        </div>

        {/* Desktop Layout (>= md): Name column + up to 3 field columns */}
        <div className="hidden md:flex items-center gap-4 flex-1 min-w-0">
          <div className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors truncate w-40 lg:w-52 shrink-0">
            {item.name}
          </div>

          {/* Up to 3 field values as columns */}
          <div className="grid grid-cols-3 gap-3 flex-1 min-w-0 text-xs text-slate-600">
            {displayedFields.map((field) => (
              <div key={field.id} className="min-w-0 truncate">
                <span className="text-slate-400 font-medium">{field.name}: </span>
                <span className="font-semibold text-slate-700">
                  {formatCompactFieldValue(field, item.data?.[field.id])}
                </span>
              </div>
            ))}
          </div>

          {/* Tag Chips on wider screens */}
          {itemTags.length > 0 && (
            <div className="hidden lg:flex items-center gap-1 shrink-0">
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

          {/* Urgent Reminder Status Chip on Desktop */}
          {urgentReminder && (
            <div className="flex items-center gap-1 shrink-0">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border truncate max-w-[200px] ${
                  urgentReminder.status === 'overdue' || urgentReminder.status === 'today'
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : urgentReminder.status === 'soon'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
                title={`${urgentReminder.fieldName}: ${formatDateLabel(urgentReminder.dueDate)} (${formatRelativeDays(urgentReminder.daysLeft)})`}
              >
                <Bell className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate">
                  {urgentReminder.fieldName}: {formatRelativeDays(urgentReminder.daysLeft)}
                </span>
              </span>
              {totalRemindersCount && totalRemindersCount > 1 && (
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200"
                  title={`+${totalRemindersCount - 1} dalších termínů`}
                >
                  +{totalRemindersCount - 1}
                </span>
              )}
            </div>
          )}

          {/* Event count */}
          <div className="text-xs text-slate-400 shrink-0 whitespace-nowrap">
            {eventCount > 0 ? getEventCountText(eventCount) : 'Bez událostí'}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
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
  );
};
