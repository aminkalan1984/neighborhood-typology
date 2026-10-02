import { Search, MessageSquare, Bell, User, Tv } from 'lucide-react';
import { useState, ChangeEvent } from 'react';

interface HeaderProps {
  onSearchChange: (query: string) => void;
  onOpenAIChat: () => void;
  isPremium: boolean;
  isWallMode?: boolean;
  onToggleWallMode?: () => void;
}

export default function Header({ 
  onSearchChange, 
  onOpenAIChat, 
  isPremium,
  isWallMode = false,
  onToggleWallMode
}: HeaderProps) {
  const [searchValue, setSearchValue] = useState('');
  const [notificationsOpen, setNotificationsDropdown] = useState(false);

  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchValue(val);
    onSearchChange(val);
  };

  const notifications = [
    { id: 1, text: 'تخصیص بودجه جدید به مبلغ ۱,۴۵۰ میلیون دلار برای فیبر نوری ثبت شد.', time: 'هم‌اکنون' },
    { id: 2, text: 'پروژه احداث ابرنیروگاه خورشیدی به پیشرفت ۳۴٪ رسید.', time: '۲ ساعت پیش' },
    { id: 3, text: 'هشدار پایش شبکه توزیع آب شرب ثبت گردید.', time: 'امروز' }
  ];

  return (
    <header 
      id="header" 
      className={`w-full flex items-center justify-between gap-4 flex-wrap py-3.5 px-4 md:px-8 border-b select-none shrink-0 z-20 transition-colors duration-300 ${
        isWallMode 
          ? 'dark bg-wall-900 border-wall-700 text-white' 
          : 'bg-paper/80 backdrop-blur-sm border-line text-ink-800'
      }`}
    >
      {/* Right Side (since RTL): Navigation Title */}
      <div id="header-title" className="flex flex-col">
        <div className="flex items-center gap-2.5">
          <h1 className={`font-black transition-all leading-tight ${isWallMode ? 'text-2xl text-signal-400' : 'text-xl text-brand-800'}`}>
            میز کار حکمرانی هوشمند کشور
          </h1>
          {isWallMode && (
            <span className="bg-danger/20 text-danger-soft border border-danger/30 text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-danger animate-live-pulse-red"></span>
              پخش زنده ویدئووال
            </span>
          )}
        </div>
        {!isWallMode && (
          <p className="text-[10px] text-ink-500 mt-0.5">پایش متمرکز بودجه ملی، پروژه‌های راهبردی و دستیار تصمیم‌گیری کلان</p>
        )}
      </div>

      {/* Middle/Left Side: Search & Controls */}
      <div id="header-controls" className="flex items-center gap-4">
        
        {/* VIDEO WALL MODE TOGGLE BUTTON */}
        <button
          id="btn-wall-mode-toggle"
          onClick={onToggleWallMode}
          className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all duration-300 flex items-center gap-2 cursor-pointer shadow-sm ${
            isWallMode
              ? 'bg-signal-400 text-wall-900 hover:bg-signal-300 shadow-[var(--shadow-glow)]'
              : 'bg-brand-800 text-signal-400 hover:bg-brand-700 hover:shadow-[var(--shadow-card-hover)]'
          }`}
          title="تغییر به حالت ویدئووال برای اتاق‌های جلسه و نمایشگرهای بزرگ"
        >
          <Tv size={16} className={isWallMode ? 'animate-bounce' : ''} />
          <span>{isWallMode ? 'خروج از ویدئووال' : 'حالت ویدئووال'}</span>
        </button>

        {/* Hide non-essential search bar in Wall Mode */}
        {!isWallMode && (
          <div id="search-bar" className="relative w-64 hidden sm:block">
            <input
              id="search-input"
              type="text"
              placeholder="جستجو در اسناد تخصیص بودجه..."
              value={searchValue}
              onChange={handleSearch}
              className="w-full bg-brand-50 border border-line rounded-full pl-4 pr-10 py-2 text-xs text-ink-800 placeholder-ink-400 focus:outline-none focus:border-brand-800 focus:ring-2 focus:ring-brand-800/15 transition-all"
            />
            <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          </div>
        )}

        {/* Buttons Icon Group */}
        <div id="action-buttons" className="flex items-center gap-2.5">
          {/* AI Chat Button */}
          <button
            id="btn-ai-chat"
            onClick={onOpenAIChat}
            className={`w-9 h-9 rounded-full transition-all flex items-center justify-center relative cursor-pointer group ${
              isWallMode 
                ? 'bg-wall-800 text-signal-400 hover:bg-wall-700' 
                : 'bg-brand-100 text-brand-800 hover:bg-signal-300'
            }`}
            title="دستیار هوشمند حکمرانی"
          >
            <MessageSquare size={17} />
            <span className="absolute -top-1 -left-1 size-2.5 bg-signal-400 rounded-full border-2 border-surface animate-live-pulse" />
          </button>

          {/* Notifications Bell */}
          {!isWallMode && (
            <div className="relative">
              <button
                id="btn-notifications"
                onClick={() => setNotificationsDropdown(!notificationsOpen)}
                className="w-9 h-9 rounded-full bg-brand-100 text-brand-800 hover:bg-signal-300 transition-all flex items-center justify-center relative cursor-pointer"
              >
                <Bell size={17} />
                <span className="absolute top-1.5 left-2 size-2 bg-danger rounded-full animate-live-pulse-red" />
              </button>

              {notificationsOpen && (
                <div id="notifications-dropdown" className="absolute left-0 mt-3 w-80 bg-surface border border-line rounded-2xl shadow-[var(--shadow-pop)] p-4 z-40 animate-fade-in">
                  <div className="flex items-center justify-between pb-3 border-b border-line mb-2">
                    <span className="text-xs font-bold text-brand-800">اعلان‌های حاکمیتی</span>
                    <button 
                      onClick={() => setNotificationsDropdown(false)}
                      className="text-[10px] text-ink-400 hover:text-brand-800 transition-colors"
                    >
                      بستن
                    </button>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {notifications.map((n) => (
                      <div key={n.id} className="flex flex-col gap-1 text-right text-[11px] p-2 hover:bg-paper rounded-lg transition-colors">
                        <p className="text-ink-800 font-medium leading-relaxed">{n.text}</p>
                        <span className="text-[9px] text-ink-400">{n.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Vertical Divider */}
        <div className={`h-6 w-[1px] ${isWallMode ? 'bg-wall-700' : 'bg-line'}`} />

        {/* User Profile */}
        <div id="user-profile" className="flex items-center gap-2.5">
          <div className="flex flex-col items-end hidden md:flex">
            <span className={`text-xs font-bold flex items-center gap-1.5 ${isWallMode ? 'text-white' : 'text-brand-800'}`}>
              دکتر امین کلانتری
              {isPremium && (
                <span className="bg-signal-400 text-brand-900 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full">ارشد</span>
              )}
            </span>
            <span className={`text-[10px] ${isWallMode ? 'text-slate-400' : 'text-ink-500'}`}>وزیر امور اقتصادی و دارایی</span>
          </div>
          <div id="avatar" className={`w-9 h-9 rounded-full flex items-center justify-center overflow-hidden border ring-2 ring-brand-800/10 ${isWallMode ? 'border-wall-700 bg-wall-800' : 'border-line bg-signal-300'}`}>
            <img 
              src="/avatar.svg" 
              alt="Avatar" 
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
