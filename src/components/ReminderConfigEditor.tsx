import React, { useState } from 'react';
import { Bell } from 'lucide-react';

interface ReminderConfigEditorProps {
  enabled: boolean;
  daysBefore: number;
  onToggle: (enabled: boolean) => void;
  onChangeDaysBefore: (days: number) => void;
  compact?: boolean;
  label?: string;
}

const PRESET_DAYS = [7, 14, 30, 60, 90];

export const ReminderConfigEditor: React.FC<ReminderConfigEditorProps> = ({
  enabled,
  daysBefore,
  onToggle,
  onChangeDaysBefore,
  compact = false,
  label = 'Upozorňovat na termín',
}) => {
  const isCustom = !PRESET_DAYS.includes(daysBefore);
  const [selectMode, setSelectMode] = useState<string>(
    isCustom ? 'custom' : String(daysBefore || 30)
  );

  React.useEffect(() => {
    const isPreset = PRESET_DAYS.includes(daysBefore);
    setSelectMode(isPreset ? String(daysBefore) : 'custom');
  }, [daysBefore]);

  const handleSelectChange = (val: string) => {
    setSelectMode(val);
    if (val !== 'custom') {
      const days = parseInt(val, 10);
      if (!isNaN(days)) {
        onChangeDaysBefore(days);
      }
    }
  };

  const handleCustomDaysChange = (val: string) => {
    const parsed = parseInt(val, 10);
    if (isNaN(parsed)) {
      onChangeDaysBefore(1);
    } else {
      const clamped = Math.max(1, Math.min(365, parsed));
      onChangeDaysBefore(clamped);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-2 flex-wrap py-1 text-xs">
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
          />
          <Bell className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span className="font-semibold text-slate-700">{label}</span>
        </label>

        {enabled && (
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-slate-500 font-medium">předem</span>
            <select
              value={selectMode}
              onChange={(e) => handleSelectChange(e.target.value)}
              className="px-2 py-1 text-xs rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none bg-white font-medium text-slate-800"
            >
              <option value="7">7 dní</option>
              <option value="14">14 dní</option>
              <option value="30">30 dní</option>
              <option value="60">60 dní</option>
              <option value="90">90 dní</option>
              <option value="custom">Vlastní...</option>
            </select>

            {selectMode === 'custom' && (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={daysBefore}
                  onChange={(e) => handleCustomDaysChange(e.target.value)}
                  className="w-14 px-1.5 py-1 text-xs rounded-lg border border-slate-300 focus:border-indigo-500 outline-none bg-white font-semibold text-slate-900"
                  placeholder="1-365"
                />
                <span className="text-[11px] text-slate-500">d</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="pt-2 border-t border-slate-200/80 space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
          />
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
            <Bell className="w-3.5 h-3.5 text-indigo-600" />
            <span>Upozorňovat na termín</span>
          </div>
        </label>
      </div>

      {enabled && (
        <div className="pl-6 space-y-2 animate-in fade-in duration-100">
          <label className="block text-xs font-semibold text-slate-700">
            Upozornit předem (dní)
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectMode}
              onChange={(e) => handleSelectChange(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none bg-white font-medium text-slate-800"
            >
              <option value="7">7 dní</option>
              <option value="14">14 dní</option>
              <option value="30">30 dní (výchozí)</option>
              <option value="60">60 dní</option>
              <option value="90">90 dní</option>
              <option value="custom">Vlastní počet dní...</option>
            </select>

            {selectMode === 'custom' && (
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={daysBefore}
                  onChange={(e) => handleCustomDaysChange(e.target.value)}
                  className="w-20 px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none bg-white font-semibold text-slate-900"
                  placeholder="1-365"
                />
                <span className="text-xs text-slate-500">dní (1–365)</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
