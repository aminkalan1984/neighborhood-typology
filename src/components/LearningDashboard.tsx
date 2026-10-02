// ============================================================
// صفحه حافظه زنده و یادگیری
// با قابلیت حذف قواعد و پاک‌سازی
// ============================================================
import { useState, useRef, type ChangeEvent } from 'react';
import { BookOpen, Trash2, XCircle, Download, Upload, FileJson } from 'lucide-react';
import type { LivingMemoryEntry, CapitalKey } from '../algorithm/types';
import { CAPITAL_FA } from '../algorithm/types';

interface Props {
  entries?: LivingMemoryEntry[];
  onEntriesChange?: (entries: LivingMemoryEntry[]) => void;
}

export default function LearningDashboard({ entries = [], onEntriesChange }: Props) {
  const [filter, setFilter] = useState<CapitalKey | 'all'>('all');

  const filtered = filter === 'all' ? entries : entries.filter(e => e.capitalKey === filter);
  const activeRules = entries.filter(e => !e.supersededBy);

  const handleDelete = (id: string) => {
    const updated = entries.filter(e => e.id !== id);
    onEntriesChange?.(updated);
  };

  const handleClearAll = () => {
    onEntriesChange?.([]);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const data = {
      version: 1,
      exportDate: new Date().toISOString(),
      neighborhood: localStorage.getItem('ara_neighborhood_name') || 'نامشخص',
      totalEntries: entries.length,
      activeRules: activeRules.length,
      entries
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ara-learning-memory-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.entries && Array.isArray(data.entries)) {
          const merged = [...entries];
          let added = 0;
          for (const entry of data.entries) {
            if (entry.id && entry.rule && entry.capitalKey && !merged.find(m => m.id === entry.id)) {
              merged.push(entry);
              added++;
            }
          }
          onEntriesChange?.(merged);
          alert(`✅ ${added} قاعده جدید اضافه شد\n(از مجموع ${data.entries.length} قاعده در فایل)\nتاریخ صادرات: ${data.exportDate || 'نامشخص'}\nتعداد کل فعلی: ${merged.length}`);
        } else {
          alert('❌ فایل معتبر نیست — فرمت JSON با کلید entries مورد نیاز است');
        }
      } catch {
        alert('❌ خواندن فایل ناموفق — فایل باید JSON معتبر باشد');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <BookOpen className="text-purple-400" />
          حافظه زنده و یادگیری
        </h3>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <>
              <button
                onClick={handleExport}
                className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 bg-green-900/20 px-3 py-1 rounded-lg transition-colors"
                title="خروجی JSON"
              >
                <Download size={14} />
                خروجی
              </button>
              <button
                onClick={handleClearAll}
                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 bg-red-900/20 px-3 py-1 rounded-lg transition-colors"
              >
                <XCircle size={14} />
                پاک‌سازی
              </button>
            </>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 bg-blue-900/20 px-3 py-1 rounded-lg transition-colors"
            title="ورود فایل JSON"
          >
            <Upload size={14} />
            ورودی
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImport}
            className="hidden"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="کل قواعد" value={entries.length} />
        <StatCard label="قواعد فعال" value={activeRules.length} />
        <StatCard label="موفق" value={entries.filter(e => e.outcome === 'success').length} color="green" />
        <StatCard label="ناموفق" value={entries.filter(e => e.outcome === 'failure').length} color="red" />
      </div>

      {/* Q/T/R History Chart */}
      {entries.length >= 1 && (
        <QTRHistory entries={entries} />
      )}

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded text-xs ${filter === 'all' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400'}`}
        >
          همه
        </button>
        {(['H', 'S', 'E', 'P', 'N', 'C', 'G', 'R'] as CapitalKey[]).map(cap => (
          <button
            key={cap}
            onClick={() => setFilter(cap)}
            className={`px-3 py-1 rounded text-xs ${filter === cap ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400'}`}
          >
            {CAPITAL_FA[cap]}
          </button>
        ))}
      </div>

      {/* Rules */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-6 text-center text-gray-500">
            {entries.length === 0
              ? 'هنوز قاعده‌ای ثبت نشده است — با اولین تحلیل محله، حافظه یادگیری پر می‌شود'
              : 'هیچ قاعده‌ای در این دسته وجود ندارد'}
          </div>
        ) : (
          filtered.map(entry => (
            <div key={entry.id} className={`bg-gray-800 rounded-lg p-3 group ${entry.supersededBy ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">[{entry.capitalKey}] {CAPITAL_FA[entry.capitalKey]}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    entry.outcome === 'success' ? 'bg-green-900 text-green-300' :
                    entry.outcome === 'failure' ? 'bg-red-900 text-red-300' :
                    'bg-yellow-900 text-yellow-300'
                  }`}>
                    {entry.outcome === 'success' ? 'موفق' :
                     entry.outcome === 'failure' ? 'ناموفق' : 'نیمه‌کاره'}
                  </span>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all"
                    title="حذف این قاعده"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-200">{entry.rule}</p>
              {entry.evidence && (
                <p className="text-xs text-gray-400 mt-1 truncate">{entry.evidence}</p>
              )}
              <div className="text-xs text-gray-500 mt-1 flex items-center justify-between">
                <span>ثبت: {entry.dateRecorded.slice(0, 10)} | اعمال: {entry.applicationCount} بار</span>
                {entry.supersededBy && (
                  <span className="text-yellow-500">جابجا شده</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {entries.length > 0 && (
        <div className="text-xs text-gray-600 text-center flex items-center justify-center gap-2">
          <FileJson size={12} />
          <span>{entries.length} قاعده ذخیره شده — داده‌ها در localStorage نگهداری می‌شوند</span>
          <span>•</span>
          <span>برای پشتیبان‌گیری از «خروجی» استفاده کنید</span>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  const textColor = color === 'green' ? 'text-green-400' : color === 'red' ? 'text-red-400' : 'text-purple-400';
  return (
    <div className="bg-gray-800 rounded-lg p-3 text-center">
      <div className={`text-2xl font-bold ${textColor}`}>{value}</div>
      <div className="text-xs text-gray-400">{label}</div>
    </div>
  );
}

/** Parse Q, T, R from rule text like "4 منبع | Q=31.2 | ..." */
function parseQTR(rule: string): { Q: number; T: number; R: number } | null {
  const qMatch = rule.match(/Q=([\d.]+)/);
  const tMatch = rule.match(/T=([\d.]+)/);
  const rMatch = rule.match(/R=([\d.]+)/);
  if (!qMatch || !tMatch || !rMatch) return null;
  return { Q: parseFloat(qMatch[1]), T: parseFloat(tMatch[1]), R: parseFloat(rMatch[1]) };
}

function QTRHistory({ entries }: { entries: LivingMemoryEntry[] }) {
  const dataPoints = entries
    .map(e => ({ ...e, qtr: parseQTR(e.rule) }))
    .filter((e): e is LivingMemoryEntry & { qtr: { Q: number; T: number; R: number } } => e.qtr !== null)
    .slice(-10); // last 10

  if (dataPoints.length === 0) return null;

  const maxVal = 100;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h4 className="font-bold text-sm mb-3">📈 روند Q / T / R در تحلیل‌های قبلی</h4>
      <div className="flex gap-1 items-end h-32">
        {dataPoints.map((dp, i) => {
          const qH = (dp.qtr.Q / maxVal) * 100;
          const tH = (dp.qtr.T / maxVal) * 100;
          const rH = (dp.qtr.R / maxVal) * 100;
          return (
            <div key={dp.id} className="flex-1 flex flex-col items-center gap-0.5" title={`Q=${dp.qtr.Q.toFixed(1)} T=${dp.qtr.T.toFixed(1)} R=${dp.qtr.R.toFixed(1)}`}>
              <div className="w-full flex gap-px items-end" style={{ height: '100px' }}>
                <div className="flex-1 rounded-t" style={{ height: `${qH}%`, backgroundColor: '#ef4444' }} />
                <div className="flex-1 rounded-t" style={{ height: `${tH}%`, backgroundColor: '#f59e0b' }} />
                <div className="flex-1 rounded-t" style={{ height: `${rH}%`, backgroundColor: '#22c55e' }} />
              </div>
              <div className="text-[9px] text-gray-500 truncate w-full text-center">{dp.trigger?.slice(10, 20)}</div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 mt-2 justify-center">
        <span className="text-xs flex items-center gap-1"><span className="w-3 h-2 rounded bg-red-500 inline-block" /> Q</span>
        <span className="text-xs flex items-center gap-1"><span className="w-3 h-2 rounded bg-amber-500 inline-block" /> T</span>
        <span className="text-xs flex items-center gap-1"><span className="w-3 h-2 rounded bg-green-500 inline-block" /> R</span>
      </div>
    </div>
  );
}
