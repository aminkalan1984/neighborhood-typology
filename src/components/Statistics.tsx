import { ArrowDownLeft, ArrowUpRight, TrendingUp, TrendingDown, Landmark } from 'lucide-react';

interface StatisticsProps {
  totalIncoming: number;
  totalExpenses: number;
  totalSavings: number;
}

export default function Statistics({ totalIncoming, totalExpenses, totalSavings }: StatisticsProps) {
  const cards = [
    {
      id: 'incoming',
      title: 'جمع کل بودجه تخصیصی (خزانه)',
      amount: totalIncoming,
      trend: '+۱۲.۴٪',
      isPositive: true,
      color: '#1E4841',
      bgColor: '#ECF4E9',
      icon: ArrowDownLeft,
      trendIcon: ArrowUpRight,
      trendBg: '#BBF49C',
      trendText: '#1E4841'
    },
    {
      id: 'outgoing',
      title: 'بودجه‌های جذب‌شده عملیاتی',
      amount: totalExpenses,
      trend: '-۴.۲٪',
      isPositive: false,
      color: '#F73541',
      bgColor: '#FDCED1',
      icon: ArrowUpRight,
      trendIcon: ArrowDownLeft,
      trendBg: '#FDCED1',
      trendText: '#F73541'
    },
    {
      id: 'savings',
      title: 'ذخیره ارزی استراتژیک کشور',
      amount: totalSavings,
      trend: '+۸.۹٪',
      isPositive: true,
      color: '#10B981',
      bgColor: '#ECF4E9',
      icon: Landmark,
      trendIcon: ArrowUpRight,
      trendBg: '#BBF49C',
      trendText: '#1E4841'
    }
  ];

  return (
    <div id="statistics-cards" className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full select-none">
      {cards.map((card) => {
        const IconComponent = card.icon;
        const TrendIconComponent = card.trendIcon;

        return (
          <div 
            key={card.id}
            id={`stat-card-${card.id}`}
            className="bg-surface border border-line rounded-2xl p-4 flex flex-col justify-between h-40 hover:shadow-md transition-all duration-300"
          >
            {/* Header: Icon & Sparkles trend badge */}
            <div className="flex items-center justify-between">
              <div 
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: card.bgColor }}
              >
                <IconComponent size={18} style={{ color: card.color }} />
              </div>
              
              {/* Trend percentage pill */}
              <div 
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold"
                style={{ backgroundColor: card.trendBg, color: card.trendText }}
              >
                <TrendIconComponent size={10} />
                <span>{card.trend}</span>
              </div>
            </div>

            {/* Bottom section: Amount & Label */}
            <div className="flex flex-col gap-1.5 mt-4">
              <h3 className="text-xl font-bold font-mono tracking-tight text-ink-800">
                {card.amount.toLocaleString()}
                <span className="text-xs text-ink-500 font-semibold mr-1">میلیون دلار</span>
              </h3>
              <span className="text-[11px] text-ink-500 font-medium">{card.title}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
