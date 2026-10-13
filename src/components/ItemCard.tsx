import React from 'react';
import { Item, FieldDefinition, ItemEvent, Attachment, Tag } from '../types';
import { Edit2, Trash2, ArrowRight, Image as ImageIcon } from 'lucide-react';
import { useAttachmentUrl } from '../hooks/useAttachmentUrl';
import { getTagColorOption } from '../utils/tagColors';

interface ItemCardProps {
  item: Item;
  fields: FieldDefinition[];
  events?: ItemEvent[];
  mainPhoto?: Attachment | null;
  tags?: Tag[];
  onOpenDetail: (item: Item) => void;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({
  item,
  fields,
  events = [],
  mainPhoto,
  tags = [],
  onOpenDetail,
  onEdit,
  onDelete,
}) => {
  const activeFields = fields.filter((f) => f.target === 'ITEM' && !f.is_archived);
  const coverUrl = useAttachmentUrl(mainPhoto?.blob);

  // Resolved tags for this item
  const itemTags = tags.filter((t) => item.tag_ids?.includes(t.id));
  const displayedTags = itemTags.slice(0, 3);
  const remainingTagCount = itemTags.length - 3;

  const formatFieldValue = (field: FieldDefinition, val: any) => {
    if (val === undefined || val === null || val === '') return null;

    if (field.data_type === 'single_select') {
      const option = field.config?.options?.find((o) => o.id === val);
      return (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-800"
          style={
            option?.color
              ? { backgroundColor: `${option.color}15`, color: option.color }
              : undefined
          }
        >
          {option ? option.label : String(val)}
        </span>
      );
    }

    if (field.data_type === 'boolean') {
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${
            val ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {val ? 'Ano' : 'Ne'}
        </span>
      );
    }

    if (field.data_type === 'number') {
      const formatted =
        typeof val === 'number'
          ? new Intl.NumberFormat('cs-CZ').format(val)
          : String(val);
      return (
        <span className="font-semibold text-slate-900">
          {formatted} {field.unit ? `${field.unit}` : ''}
        </span>
      );
    }

    if (field.data_type === 'date') {
      try {
        const parts = String(val).split('-');
        if (parts.length === 3) {
          return `${parseInt(parts[2], 10)}. ${parseInt(parts[1], 10)}. ${parts[0]}`;
        }
      } catch {
        // fallback
      }
      return String(val);
    }

    return String(val);
  };

  const formatDateLabel = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parseInt(parts[2], 10)}. ${parseInt(parts[1], 10)}. ${parts[0]}`;
      }
    } catch {
      // fallback
    }
    return dateStr;
  };

  // Determine event count and most recent event date
  const eventCount = events.length;
  const sortedEvents = [...events].sort((a, b) => {
    if (a.event_date !== b.event_date) {
      return b.event_date.localeCompare(a.event_date);
    }
    const timeA = a.event_time || '';
    const timeB = b.event_time || '';
    if (timeA !== timeB) {
      if (!timeA) return 1;
      if (!timeB) return -1;
      return timeB.localeCompare(timeA);
    }
    return b.created_at.localeCompare(a.created_at);
  });

  const latestEvent = sortedEvents[0];

  const getEventCountText = (count: number) => {
    if (count === 1) return '1 událost';
    if (count >= 2 && count <= 4) return `${count} události`;
    return `${count} událostí`;
  };

  return (
    <div
      onClick={() => onOpenDetail(item)}
      className="bg-white rounded-2xl border border-slate-200/90 hover:border-indigo-300 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer overflow-hidden"
    >
      {/* Cover photo or placeholder */}
      <div className="relative w-full h-44 bg-slate-50 flex items-center justify-center overflow-hidden border-b border-slate-100">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={item.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-slate-500 transition-colors">
            <ImageIcon className="w-8 h-8 stroke-[1.5] text-slate-300 mb-1" />
            <span className="text-[11px] font-medium text-slate-400">Bez fotografie</span>
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col justify-between flex-1">
        <div>
          {/* Item Title and Action Buttons */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="font-bold text-base text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
              {item.name}
            </h3>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(item);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 hover:text-indigo-700 bg-slate-100 hover:bg-indigo-50 border border-slate-200/70 transition-colors cursor-pointer"
                title="Upravit položku"
              >
                <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Upravit</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 hover:text-red-700 bg-slate-100 hover:bg-red-50 border border-slate-200/70 transition-colors cursor-pointer"
                title="Smazat položku"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Smazat</span>
              </button>
            </div>
          </div>

          {/* Tags chips (max 3, then +N) */}
          {itemTags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
              {displayedTags.map((tag) => {
                const opt = getTagColorOption(tag.color);
                return (
                  <span
                    key={tag.id}
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
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
                  className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200"
                  title={`+${remainingTagCount} dalších štítků`}
                >
                  +{remainingTagCount}
                </span>
              )}
            </div>
          )}

          {/* Custom Field Values */}
          <div className="space-y-1.5 mt-3 pt-3 border-t border-slate-100 text-xs">
            {activeFields.map((field) => {
              const rawVal = item.data?.[field.id];
              if (rawVal === undefined || rawVal === null || rawVal === '') {
                return null;
              }

              return (
                <div
                  key={field.id}
                  className="flex items-center justify-between gap-2 py-1 border-b border-slate-50 last:border-none"
                >
                  <span className="text-slate-500 font-medium truncate max-w-[130px]">
                    {field.name}:
                  </span>
                  <div className="text-right truncate max-w-[180px]">
                    {formatFieldValue(field, rawVal)}
                  </div>
                </div>
              );
            })}

            {Object.keys(item.data || {}).length === 0 && (
              <div className="text-slate-400 italic py-1">
                Žádné doplňující vlastnosti
              </div>
            )}
          </div>
        </div>

        {/* Footer Info & Explicit Open Detail Button */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium truncate max-w-[200px]">
            {eventCount > 0 && latestEvent ? (
              <>
                <strong>{getEventCountText(eventCount)}</strong> · poslední{' '}
                {formatDateLabel(latestEvent.event_date)}
              </>
            ) : (
              'Zatím bez událostí'
            )}
          </span>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail(item);
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 shadow-2xs transition-colors cursor-pointer shrink-0"
          >
            <span>Otevřít detail</span>
            <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
};
