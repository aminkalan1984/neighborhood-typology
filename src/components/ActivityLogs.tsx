import { GovernanceLog } from '../types';
import { User, Trash2 } from 'lucide-react';

interface ActivityLogsProps {
  logs: GovernanceLog[];
  onClearLogs: () => void;
}

export default function ActivityLogs({ logs, onClearLogs }: ActivityLogsProps) {
  return (
    <div id="activity-logs-section" className="border border-line bg-surface rounded-2xl p-5 w-full flex flex-col gap-4 shadow-sm select-none text-right">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink-800">گزارش‌های زنده مرکز مانیتورینگ کشور</h2>
        {logs.length > 0 && (
          <button
            onClick={onClearLogs}
            className="text-[10px] text-danger hover:text-danger font-semibold flex items-center gap-1 cursor-pointer"
          >
            <Trash2 size={12} />
            <span>پاک‌سازی وقایع</span>
          </button>
        )}
      </div>

      {/* Activity Timeline List */}
      <div id="logs-timeline" className="flex flex-col gap-4 mt-1">
        {logs.map((log, idx) => (
          <div key={log.id} className="flex gap-3 relative group">
            {/* Timeline connectors */}
            {idx !== logs.length - 1 && (
              <span 
                className="absolute right-4.5 top-8 bottom-0 w-[1px] bg-line pointer-events-none group-hover:bg-signal-400 transition-colors"
                style={{ height: 'calc(100% + 8px)' }}
              />
            )}

            {/* Avatar block with dynamic fallback */}
            <div id="log-avatar" className="relative shrink-0 w-9 h-9 rounded-full bg-brand-100 border border-line flex items-center justify-center overflow-hidden">
              <img 
                src={log.userAvatar} 
                alt={log.userName}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <User size={14} className="text-brand-800" />
              
              {/* Dynamic Status Dot */}
              <span 
                className="absolute bottom-0 left-0 w-2.5 h-2.5 rounded-full border-2 border-white"
                style={{ backgroundColor: log.statusColor }}
              />
            </div>

            {/* Log text description */}
            <div className="flex flex-col gap-1 text-right">
              <div className="text-[11px] text-ink-800 leading-relaxed">
                <span className="font-extrabold text-brand-800 ml-1">{log.userName}</span>
                <span className="text-[9px] bg-paper text-ink-500 px-1.5 py-0.5 rounded-md ml-1.5 font-semibold inline-block">{log.role}</span>
                <span>{log.description}</span>
              </div>
              <span className="text-[9px] text-ink-500 font-mono">{log.time}</span>
            </div>
          </div>
        ))}

        {logs.length === 0 && (
          <div className="py-8 text-center text-ink-500 text-xs font-semibold">
            هیچ گزارش یا هشداری ثبت نگردیده است. (پایش شبکه در وضعیت کاملاً پایدار)
          </div>
        )}
      </div>
    </div>
  );
}
