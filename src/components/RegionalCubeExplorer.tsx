import { useState } from 'react';
import { 
  neyrizCubeCells, 
  neyrizFrameworkCells, 
  neyrizCapitals, 
  neyrizRegionInfo, 
  initialNationalProjects 
} from '../data';
import { CubeCell, FrameworkCell } from '../types';
import { 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  Maximize2, 
  ChevronLeft,
  Sparkles,
  Database,
  Search,
  Zap,
  TrendingUp,
  MapPin
} from 'lucide-react';

export default function RegionalCubeExplorer() {
  const [activeTab, setActiveTab] = useState<'cube' | 'framework' | 'capitals'>('cube');
  const [selectedCubeCell, setSelectedCubeCell] = useState<CubeCell | null>(neyrizCubeCells[0]);
  const [selectedFrameworkCell, setSelectedFrameworkCell] = useState<FrameworkCell | null>(neyrizFrameworkCells[0]);

  // Color mapper based on the qualitative level of cell
  const getLevelColor = (level: string) => {
    switch (level) {
      case 'excellent': return { bg: 'bg-brand-100', text: 'text-brand-800', border: 'border-signal-400', bar: 'bg-brand-800' };
      case 'high': return { bg: 'bg-ok-soft', text: 'text-ok', border: 'border-ok/40', bar: 'bg-ok' };
      case 'mid': return { bg: 'bg-warn-soft', text: 'text-warn', border: 'border-warn/40', bar: 'bg-warn' };
      case 'low': return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', bar: 'bg-orange-500' };
      case 'critical': return { bg: 'bg-danger-soft', text: 'text-danger', border: 'border-danger/40', bar: 'bg-danger' };
      default: return { bg: 'bg-paper', text: 'text-ink-700', border: 'border-line', bar: 'bg-paper0' };
    }
  };

  // Translation mapper
  const translateLevel = (level: string) => {
    switch (level) {
      case 'excellent': return 'ممتاز (L5)';
      case 'high': return 'خوب / بالا (L4)';
      case 'mid': return 'متوسط / پایدار (L3)';
      case 'low': return 'ضعیف / نیاز به مداخله (L2)';
      case 'critical': return 'بحرانی / اضطراری (L1)';
      default: return level;
    }
  };

  return (
    <div id="regional-cube-explorer" className="panel-card p-6 flex flex-col gap-6 text-right select-none">
      
      {/* Pilot Header Info Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-line pb-5 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-100 text-brand-800 flex items-center justify-center">
            <Layers size={24} />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-ink-800">شبیه‌ساز مکعب ۳بعدی حاکمیتی ایران (آرا)</h2>
              <span className="text-[10px] bg-brand-800 text-signal-400 px-2 py-0.5 rounded-full font-bold">پایلوت اجرایی</span>
            </div>
            <p className="text-xs text-ink-500">برنامه پایش پایداری و توسعه متوازن بر اساس الگوهای توحیدی آمایش</p>
          </div>
        </div>

        {/* Neyriz Base Stats Pills */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="bg-surface border border-line px-3.5 py-1.5 rounded-xl flex items-center gap-2 text-xs">
            <MapPin size={13} className="text-brand-800" />
            <span className="text-ink-500">محدوده:</span>
            <span className="font-bold text-ink-800">{neyrizRegionInfo.name} ({neyrizRegionInfo.province})</span>
          </div>
          <div className="bg-surface border border-line px-3.5 py-1.5 rounded-xl flex items-center gap-2 text-xs">
            <span className="text-ink-500">سطح سرزمینی:</span>
            <span className="font-bold text-brand-800">{neyrizRegionInfo.level}</span>
          </div>
          <div className="bg-surface border border-line px-3.5 py-1.5 rounded-xl flex items-center gap-2 text-xs">
            <span className="text-ink-500">جمعیت:</span>
            <span className="font-bold text-ink-800">{neyrizRegionInfo.population.toLocaleString()} نفر</span>
          </div>
        </div>
      </div>

      {/* Selector Tabs */}
      <div className="flex border-b border-line p-0.5 gap-2">
        <button
          onClick={() => setActiveTab('cube')}
          className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all ${
            activeTab === 'cube'
              ? 'border-b-2 border-brand-800 text-brand-800 bg-brand-100/30'
              : 'text-ink-500 hover:text-ink-800'
          }`}
        >
          ۱. مکعب سلول‌های هسته (3x3 Matrix)
        </button>
        <button
          onClick={() => setActiveTab('framework')}
          className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all ${
            activeTab === 'framework'
              ? 'border-b-2 border-brand-800 text-brand-800 bg-brand-100/30'
              : 'text-ink-500 hover:text-ink-800'
          }`}
        >
          ۲. ماتریس چارچوب موضوعی RGF-D3 (3x5 Matrix)
        </button>
        <button
          onClick={() => setActiveTab('capitals')}
          className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all ${
            activeTab === 'capitals'
              ? 'border-b-2 border-brand-800 text-brand-800 bg-brand-100/30'
              : 'text-ink-500 hover:text-ink-800'
          }`}
        >
          ۳. اسکن ستون‌های ۹گانه سرمایه
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'cube' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
          
          {/* Left Block: 3x3 interactive matrix (8 Cols of space on desktop) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-brand-800 flex items-center gap-1.5">
                <Sparkles size={14} />
                ماتریس هسته محاسباتی آرا (ابعاد × اضلاع)
              </h3>
              <span className="text-[10px] text-ink-500">مبنای طبقه‌بندی هوشمند فازی</span>
            </div>

            {/* 3x3 Grid Layout */}
            <div className="grid grid-cols-3 gap-3">
              {/* Columns Header (Need Assessment Sides) */}
              <div className="col-span-1 text-center py-2 bg-surface rounded-lg border border-line text-[10px] font-bold text-ink-500">فرصت</div>
              <div className="col-span-1 text-center py-2 bg-surface rounded-lg border border-line text-[10px] font-bold text-ink-500">استعداد</div>
              <div className="col-span-1 text-center py-2 bg-surface rounded-lg border border-line text-[10px] font-bold text-ink-500">نیاز</div>

              {/* Rows with Cells */}
              {/* Row 1: Sensing / شناخت */}
              {neyrizCubeCells.slice(0, 3).map((cell) => {
                const colors = getLevelColor(cell.level);
                const isSelected = selectedCubeCell?.code === cell.code;
                return (
                  <button
                    key={cell.code}
                    onClick={() => setSelectedCubeCell(cell)}
                    className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between h-28 cursor-pointer hover:shadow-md ${
                      isSelected 
                        ? 'border-brand-800 bg-brand-100/40 ring-2 ring-brand-800/20' 
                        : 'border-line bg-surface hover:border-ink-500'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[10px] font-bold text-ink-500 font-mono">{cell.code}</span>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-paper text-ink-800">بعد شناخت</span>
                    </div>
                    <div className="flex flex-col gap-0.5 my-2">
                      <span className="text-xs font-extrabold text-ink-800">{cell.name}</span>
                      <span className="text-[10px] text-ink-500">پایش خام سرزمینی</span>
                    </div>
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-black font-mono text-brand-800">{cell.score.toFixed(2)}</span>
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>{translateLevel(cell.level)}</span>
                    </div>
                  </button>
                );
              })}

              {/* Row 2: Reasoning / تحلیل */}
              {neyrizCubeCells.slice(3, 6).map((cell) => {
                const colors = getLevelColor(cell.level);
                const isSelected = selectedCubeCell?.code === cell.code;
                return (
                  <button
                    key={cell.code}
                    onClick={() => setSelectedCubeCell(cell)}
                    className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between h-28 cursor-pointer hover:shadow-md ${
                      isSelected 
                        ? 'border-brand-800 bg-brand-100/40 ring-2 ring-brand-800/20' 
                        : 'border-line bg-surface hover:border-ink-500'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[10px] font-bold text-ink-500 font-mono">{cell.code}</span>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-paper text-ink-800">بعد تحلیل</span>
                    </div>
                    <div className="flex flex-col gap-0.5 my-2">
                      <span className="text-xs font-extrabold text-ink-800">{cell.name}</span>
                      <span className="text-[10px] text-ink-500">موتور علیت و پیچیدگی</span>
                    </div>
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-black font-mono text-brand-800">{cell.score.toFixed(2)}</span>
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>{translateLevel(cell.level)}</span>
                    </div>
                  </button>
                );
              })}

              {/* Row 3: Acting / کنش */}
              {neyrizCubeCells.slice(6, 9).map((cell) => {
                const colors = getLevelColor(cell.level);
                const isSelected = selectedCubeCell?.code === cell.code;
                return (
                  <button
                    key={cell.code}
                    onClick={() => setSelectedCubeCell(cell)}
                    className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between h-28 cursor-pointer hover:shadow-md ${
                      isSelected 
                        ? 'border-brand-800 bg-brand-100/40 ring-2 ring-brand-800/20' 
                        : 'border-line bg-surface hover:border-ink-500'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[10px] font-bold text-ink-500 font-mono">{cell.code}</span>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-paper text-ink-800">بعد کنش</span>
                    </div>
                    <div className="flex flex-col gap-0.5 my-2">
                      <span className="text-xs font-extrabold text-ink-800">{cell.name}</span>
                      <span className="text-[10px] text-ink-500">ابلاغ طرح و تخصیص</span>
                    </div>
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-black font-mono text-brand-800">{cell.score.toFixed(2)}</span>
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>{translateLevel(cell.level)}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Quick Diagnostic Tip (Page 49) */}
            <div className="bg-warn-soft/50 border border-warn/40 p-4 rounded-2xl text-xs text-warn leading-relaxed">
              <span className="font-extrabold block text-warn mb-1 flex items-center gap-1.5">
                <AlertTriangle size={14} />
                نتیجه نهایی تشخیص الگوی غالب برای نی‌ریز:
              </span>
              طبق خروجی درخت تصمیم فازی، نی‌ریز در الگوی غالب <strong>«نیاز اشباع‌شده با حساسیت اکولوژیک»</strong> قرار دارد. توصیه پلتفرم آرا: ترکیب بسته‌های زیرساختی دیجیتال + احیای فعال تالاب بختگان + توانمندسازی صنایع بومی گلیم‌بافی (به جای سرمایه‌گذاری جدید آب‌بر معدنی).
            </div>
          </div>

          {/* Right Block: Technical Passport / Side Panel (5 Cols) */}
          <div className="lg:col-span-5 panel-card p-5 flex flex-col gap-4">
            {selectedCubeCell ? (
              <>
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-brand-800 text-white flex items-center justify-center font-mono text-xs font-bold">{selectedCubeCell.code}</span>
                    <h4 className="text-sm font-bold text-ink-800">شناسنامه فنی سلول هسته</h4>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getLevelColor(selectedCubeCell.level).bg} ${getLevelColor(selectedCubeCell.level).text}`}>
                    {translateLevel(selectedCubeCell.level)}
                  </span>
                </div>

                {/* Score progress bar */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-500">امتیاز تجمیعی چندمعیاره فازی:</span>
                    <span className="font-bold font-mono text-brand-800 text-sm">{selectedCubeCell.score.toFixed(2)} / ۱.۰۰</span>
                  </div>
                  <div className="w-full bg-paper h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${getLevelColor(selectedCubeCell.level).bar}`}
                      style={{ width: `${selectedCubeCell.score * 100}%` }}
                    />
                  </div>
                </div>

                {/* Indicators Table */}
                <div className="flex flex-col gap-2.5">
                  <span className="text-[11px] font-extrabold text-brand-800 block">قلم‌های داده و پایش بلادرنگ</span>
                  <div className="flex flex-col border border-line rounded-xl overflow-hidden bg-surface text-xs">
                    {selectedCubeCell.indicators.map((ind, idx) => (
                      <div key={idx} className={`p-3 flex items-center justify-between gap-4 border-b border-line last:border-b-0 ${idx % 2 === 0 ? 'bg-surface' : 'bg-surface'}`}>
                        <div className="flex flex-col gap-0.5 text-right">
                          <span className="font-bold text-ink-800">{ind.name}</span>
                          <span className="text-[9px] text-ink-500">منبع: {ind.source}</span>
                        </div>
                        <span className="font-extrabold text-brand-800 shrink-0 font-mono text-right">{ind.value.toLocaleString()} {ind.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Conclusions (Explainable AI narrative) */}
                {selectedCubeCell.conclusions && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-extrabold text-brand-800">تبیین محاسباتی دیوان عالی:</span>
                    <ul className="list-disc list-inside text-[11px] text-ink-500 leading-relaxed flex flex-col gap-1 text-right pr-2">
                      {selectedCubeCell.conclusions.map((conc, idx) => (
                        <li key={idx} className="list-none flex gap-1.5 items-start">
                          <span className="text-ok mt-1 shrink-0">•</span>
                          <span>{conc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Sub projects listed for the cell if Acting layer (C31, C32, C33) */}
                {selectedCubeCell.code.startsWith('C3') && (
                  <div className="border-t border-line pt-3.5 mt-1 flex flex-col gap-2">
                    <span className="text-[11px] font-extrabold text-brand-800 flex items-center gap-1">
                      <Zap size={12} />
                      بسته مداخلات و پروژه‌های کنشی متناظر:
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {initialNationalProjects.filter(p => p.cellCode === selectedCubeCell.code).map((p) => (
                        <div key={p.id} className="p-2 border border-line bg-surface rounded-xl flex items-center justify-between text-xs hover:border-signal-400 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] bg-brand-800 text-white px-1.5 py-0.5 rounded font-mono font-bold">{p.code}</span>
                            <span className="font-semibold text-ink-800">{p.title}</span>
                          </div>
                          <span className="text-[10px] font-bold text-brand-800 font-mono">{(p.savedAmount).toLocaleString()}M$</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center text-ink-500 gap-2">
                <HelpCircle size={32} className="opacity-50" />
                <p className="text-xs">یک سلول از ماتریس روبه‌رو را انتخاب کنید تا شناسنامه فنی آن پدیدار گردد.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: 3x5 Framework Matrix */}
      {activeTab === 'framework' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
          
          {/* Left Block: 3x5 interactive grid */}
          <div className="lg:col-span-7 flex flex-col gap-4 overflow-x-auto min-w-0">
            <div className="flex items-center justify-between shrink-0">
              <h3 className="text-xs font-extrabold text-brand-800 flex items-center gap-1.5">
                <Database size={14} />
                ماتریس ۱۵ خانه چارچوب موضوعی RGF-D3
              </h3>
              <span className="text-[10px] text-ink-500">تلاقی ابعاد ۳گانه با حوزه‌های ۵گانه توسعه کشور</span>
            </div>

            {/* Framework Grid Scroll Wrapper */}
            <div className="min-w-[600px] border border-line rounded-2xl overflow-hidden bg-surface">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-surface border-b border-line">
                    <th className="p-3 text-[10px] font-bold text-ink-500 border-l border-line">بعد / حوزه</th>
                    <th className="p-3 text-[10px] font-bold text-ink-500 border-l border-line">S1 منابع طبیعی</th>
                    <th className="p-3 text-[10px] font-bold text-ink-500 border-l border-line">S2 اقتصاد و معیشت</th>
                    <th className="p-3 text-[10px] font-bold text-ink-500 border-l border-line">S3 انسان و جامعه</th>
                    <th className="p-3 text-[10px] font-bold text-ink-500 border-l border-line">S4 زیرساخت و فضا</th>
                    <th className="p-3 text-[10px] font-bold text-ink-500">S5 حکمرانی و نهاد</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Row 1: Sensing / شناخت */}
                  <tr className="border-b border-line">
                    <td className="p-3 font-bold bg-surface border-l border-line text-ink-800">شناخت (X1)</td>
                    {['natural', 'economy', 'social', 'spatial', 'governance'].map((dom) => {
                      const cell = neyrizFrameworkCells.find(c => c.dimension === 'Sensing' && c.domain === dom);
                      const isSelected = selectedFrameworkCell?.code === cell?.code;
                      return (
                        <td key={dom} className={`p-2 border-l border-line last:border-l-0 ${isSelected ? 'bg-brand-100/40' : ''}`}>
                          {cell ? (
                            <button
                              onClick={() => setSelectedFrameworkCell(cell)}
                              className="w-full text-right p-2 rounded-xl hover:bg-surface transition-colors flex flex-col gap-1 cursor-pointer"
                            >
                              <span className="font-extrabold text-[11px] text-ink-800 leading-snug">{cell.name.split(' × ')[1]}</span>
                              <span className="text-[9px] text-ink-500 line-clamp-1">{cell.value}</span>
                            </button>
                          ) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Row 2: Reasoning / تحلیل */}
                  <tr className="border-b border-line">
                    <td className="p-3 font-bold bg-surface border-l border-line text-ink-800">تحلیل (X2)</td>
                    {['natural', 'economy', 'social', 'spatial', 'governance'].map((dom) => {
                      const cell = neyrizFrameworkCells.find(c => c.dimension === 'Reasoning' && c.domain === dom);
                      const isSelected = selectedFrameworkCell?.code === cell?.code;
                      return (
                        <td key={dom} className={`p-2 border-l border-line last:border-l-0 ${isSelected ? 'bg-brand-100/40' : ''}`}>
                          {cell ? (
                            <button
                              onClick={() => setSelectedFrameworkCell(cell)}
                              className="w-full text-right p-2 rounded-xl hover:bg-surface transition-colors flex flex-col gap-1 cursor-pointer"
                            >
                              <span className="font-extrabold text-[11px] text-ink-800 leading-snug">{cell.name.split(' × ')[1]}</span>
                              <span className="text-[9px] text-ink-500 line-clamp-1">{cell.value}</span>
                            </button>
                          ) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Row 3: Acting / کنش */}
                  <tr>
                    <td className="p-3 font-bold bg-surface border-l border-line text-ink-800">کنش (X3)</td>
                    {['natural', 'economy', 'social', 'spatial', 'governance'].map((dom) => {
                      const cell = neyrizFrameworkCells.find(c => c.dimension === 'Acting' && c.domain === dom);
                      const isSelected = selectedFrameworkCell?.code === cell?.code;
                      return (
                        <td key={dom} className={`p-2 border-l border-line last:border-l-0 ${isSelected ? 'bg-brand-100/40' : ''}`}>
                          {cell ? (
                            <button
                              onClick={() => setSelectedFrameworkCell(cell)}
                              className="w-full text-right p-2 rounded-xl hover:bg-surface transition-colors flex flex-col gap-1 cursor-pointer"
                            >
                              <span className="font-extrabold text-[11px] text-ink-800 leading-snug">{cell.name.split(' × ')[1]}</span>
                              <span className="text-[9px] text-ink-500 line-clamp-1">{cell.value}</span>
                            </button>
                          ) : '-'}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Block: Framework Passport Panel (5 Cols) */}
          <div className="lg:col-span-5 panel-card p-5 flex flex-col gap-4">
            {selectedFrameworkCell ? (
              <>
                <div className="flex flex-col gap-1.5 border-b border-line pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-brand-800 text-signal-400 px-2 py-0.5 rounded font-mono font-bold">{selectedFrameworkCell.code}</span>
                    <h4 className="text-sm font-bold text-ink-800">{selectedFrameworkCell.name}</h4>
                  </div>
                  <span className="text-[10px] text-ink-500">مجموعه شاخص‌های حوزه‌ای پایش آمایشی</span>
                </div>

                <div className="flex flex-col gap-1 bg-surface p-3 border border-line rounded-xl text-xs">
                  <span className="text-ink-500">مقدار / توصیف پایش ثبت شده:</span>
                  <p className="font-extrabold text-brand-800 leading-relaxed mt-1 text-right">{selectedFrameworkCell.value}</p>
                </div>

                {/* Specific indicators list */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-extrabold text-brand-800">شاخص‌های کلیدی فعال در سلول:</span>
                  <div className="flex flex-col gap-2 text-xs">
                    {selectedFrameworkCell.indicators.map((ind, idx) => (
                      <div key={idx} className="p-3 bg-surface border border-line rounded-xl flex items-center gap-2.5">
                        <CheckCircle2 size={13} className="text-ok shrink-0" />
                        <span className="font-semibold text-ink-800">{ind}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1 text-[11px]">
                  <span className="text-ink-500">منبع علمی / روش آماری احصا:</span>
                  <span className="font-bold text-ink-800 bg-paper px-2.5 py-1.5 rounded-lg mt-1">{selectedFrameworkCell.source}</span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center text-ink-500 gap-2">
                <HelpCircle size={32} className="opacity-50" />
                <p className="text-xs">یک خانه از جدول موضوعی روبه‌رو را انتخاب کنید تا مشخصات آن در این پنل نمایش داده شود.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: 9 Capitals Scans */}
      {activeTab === 'capitals' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
          
          {/* 9 Columns chart list (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-brand-800 flex items-center gap-1.5">
                <TrendingUp size={14} />
                اسکن جامع ستون‌های ۹گانه سرمایه‌ای منطقه
              </h3>
              <span className="text-[10px] text-ink-500">خروجی محاسبات ماژول فازی TMFE</span>
            </div>

            {/* Capitals progress blocks */}
            <div className="flex flex-col gap-3.5">
              {neyrizCapitals.map((cap) => (
                <div key={cap.code} className="bg-surface border border-line p-3.5 rounded-2xl hover:shadow-sm transition-all flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-paper text-ink-800 font-mono text-[10px] font-bold flex items-center justify-center">{cap.code}</span>
                      <span className="font-extrabold text-ink-800">{cap.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-ink-500 text-[10px]">امتیاز:</span>
                      <span className="font-black font-mono text-brand-800 text-sm">{cap.score} / ۱۰۰</span>
                    </div>
                  </div>

                  {/* Horizontal Bar */}
                  <div className="w-full bg-paper h-2 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${cap.score}%`, backgroundColor: cap.color }}
                    />
                  </div>

                  {/* Status label summary */}
                  <p className="text-[10.5px] text-ink-500 leading-relaxed pr-7">
                    {cap.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right Block Description (5 Cols) */}
          <div className="lg:col-span-5 panel-card p-5 flex flex-col gap-5 text-right">
            <h4 className="text-sm font-bold text-brand-800 border-b border-line pb-3">مفهوم سرمایه‌های ده‌گانه در الگوی پیشرفت</h4>
            
            <p className="text-xs text-ink-500 leading-relaxed">
              در نظام حکمرانی و برنامه‌ریزی هوشمند ایران (آرا)، ثروت یک منطقه صرفاً با دارایی‌های مالی یا فیزیکی سنجیده نمی‌شود. سرمایه منطقه یک تانسور ده‌گانه است که ابعاد فرهنگی، معنوی، طبیعی، و اجتماعی را هم‌تراز با ردیف‌های اقتصادی و زیرساخت پایش می‌کند.
            </p>

            <div className="p-4 bg-surface border border-line rounded-xl text-xs flex flex-col gap-3">
              <span className="font-extrabold text-brand-800 block">نوآوری کلیدی: سرمایه معنوی-اخلاقی</span>
              <p className="text-ink-500 leading-relaxed text-[11px]">
                پلتفرم آرا برای نخستین بار در ایران، <strong>«سرمایه معنوی-اخلاقی» (CT1)</strong> را به عنوان ستون پایش مستقل معرفی نموده که حجم موقوفات، مشارکت‌های آیینی، خیرین، و امانتداری از منابع طبیعی را وارد مدل اولویت‌بندی ریاضی دیوان محاسبات می‌کند.
              </p>
            </div>

            <div className="flex flex-col gap-1.5 text-[11px] text-ink-500">
              <span className="font-bold text-ink-800">فرمول تجمیع ستون‌ها:</span>
              <span className="font-mono bg-paper px-3 py-2 rounded-lg block ltr text-left">
                RTI_region = Σ (W_k * RC_k)
              </span>
              <span>که در آن W_k وزن ناشی از تصمیم دلفی خبرگان و RC_k مقدار تجمیع‌یافته شاخص‌های هر ستون سرمایه‌ای می‌باشد.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
