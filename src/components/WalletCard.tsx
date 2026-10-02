import { useState, FormEvent } from 'react';
import { PlusCircle, ArrowRightLeft, ArrowDownCircle, Clock, Eye, EyeOff, ShieldCheck } from 'lucide-react';

interface WalletCardProps {
  totalBalance: number;
  totalExpenses: number;
  onDeposit: (amount: number) => void;
  onTransfer: (amount: number, recipient: string, name: string) => void;
  onFilterHistory: () => void;
}

export default function WalletCard({ totalBalance, totalExpenses, onDeposit, onTransfer, onFilterHistory }: WalletCardProps) {
  const [showCVV, setShowCVV] = useState(false);
  const [activeModal, setActiveModal] = useState<'deposit' | 'transfer' | null>(null);
  
  // Local form inputs
  const [depositAmount, setDepositAmount] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferRecipient, setTransferRecipient] = useState('');
  const [transferName, setTransferName] = useState('');

  // Calculate spending bar percentages
  const expensePercentage = Math.min(Math.round((totalExpenses / (totalBalance + totalExpenses)) * 100), 100);

  const handleDepositSubmit = (e: FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(depositAmount);
    if (!isNaN(amt) && amt > 0) {
      onDeposit(amt);
      setDepositAmount('');
      setActiveModal(null);
    }
  };

  const handleTransferSubmit = (e: FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(transferAmount);
    if (!isNaN(amt) && amt > 0 && transferName.trim() && transferRecipient.trim()) {
      onTransfer(amt, transferRecipient, transferName);
      setTransferAmount('');
      setTransferRecipient('');
      setTransferName('');
      setActiveModal(null);
    }
  };

  return (
    <div id="wallet-card-container" className="flex flex-col gap-5 w-full select-none">
      {/* 1. The Credit Card Visual */}
      <div 
        id="credit-card" 
        className="bg-brand-800 text-white rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between shadow-lg h-44 hover:shadow-xl transition-all duration-300"
      >
        {/* Background Patterns */}
        <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-signal-400 rounded-full opacity-5 pointer-events-none" />
        <div className="absolute left-6 top-6 w-12 h-12 bg-surface/5 rounded-full border border-white/10 pointer-events-none" />
        
        {/* Top Section: Brand & Eye toggle */}
        <div className="flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-signal-400 flex items-center justify-center text-brand-800">
              <ShieldCheck size={12} />
            </div>
            <span className="text-[11px] font-sans font-extrabold tracking-wider text-brand-100">ARA TREASURY LEDGER</span>
          </div>
          <button 
            id="btn-toggle-cvv" 
            onClick={() => setShowCVV(!showCVV)}
            className="text-brand-100/70 hover:text-white p-1 hover:bg-surface/5 rounded-md transition-all cursor-pointer"
          >
            {showCVV ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {/* Balance Display */}
        <div className="flex flex-col gap-0.5 z-10 mt-3">
          <span className="text-[10px] text-brand-100/80 font-semibold">ذخیره نقدی خزانه متمرکز ملی</span>
          <h2 className="text-2xl font-bold tracking-wide font-mono flex items-baseline gap-1">
            {totalBalance.toLocaleString()}
            <span className="text-xs text-signal-400 font-semibold">میلیون دلار</span>
          </h2>
        </div>

        {/* Footer info: Exp Date & CVV */}
        <div className="flex items-center justify-between border-t border-white/10 pt-3 z-10 mt-auto">
          <div className="flex flex-col">
            <span className="text-[8px] text-brand-100/70">سال مالی</span>
            <span className="text-xs font-semibold tracking-wider font-mono">۱۴۰۵ هـ.ش</span>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[8px] text-brand-100/70">کد امنیتی حاکمیتی</span>
            <span className="text-xs font-semibold tracking-wider font-mono">
              {showCVV ? '۳۱۲ / ARA' : '•••'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Interactive Action Button Group */}
      <div id="quick-actions" className="bg-brand-100 rounded-2xl p-3 flex items-center justify-between shadow-sm">
        {/* Action: Deposit */}
        <button 
          id="btn-action-deposit"
          onClick={() => setActiveModal('deposit')}
          className="flex flex-col items-center gap-1.5 flex-1 hover:bg-signal-400/30 py-2 rounded-xl transition-all cursor-pointer text-center"
        >
          <PlusCircle size={22} className="text-brand-800" />
          <span className="text-[10px] font-bold text-brand-800">افزایش بودجه</span>
        </button>

        <div className="h-8 w-[1px] bg-surface" />

        {/* Action: Transfer */}
        <button 
          id="btn-action-transfer"
          onClick={() => setActiveModal('transfer')}
          className="flex flex-col items-center gap-1.5 flex-1 hover:bg-signal-400/30 py-2 rounded-xl transition-all cursor-pointer text-center"
        >
          <ArrowRightLeft size={22} className="text-brand-800" />
          <span className="text-[10px] font-bold text-brand-800">تخصیص حواله</span>
        </button>

        <div className="h-8 w-[1px] bg-surface" />

        {/* Action: Request */}
        <button 
          id="btn-action-request"
          onClick={() => {
            alert('درخواست بودجه وزارت‌خانه یا نهاد ملی با موفقیت در کارتابل دبیرخانه شورا ثبت گردید و شناسه پیگیری صادر شد.');
          }}
          className="flex flex-col items-center gap-1.5 flex-1 hover:bg-signal-400/30 py-2 rounded-xl transition-all cursor-pointer text-center"
        >
          <ArrowDownCircle size={22} className="text-brand-800" />
          <span className="text-[10px] font-bold text-brand-800">درخواست بودجه</span>
        </button>

        <div className="h-8 w-[1px] bg-surface" />

        {/* Action: History */}
        <button 
          id="btn-action-history"
          onClick={onFilterHistory}
          className="flex flex-col items-center gap-1.5 flex-1 hover:bg-signal-400/30 py-2 rounded-xl transition-all cursor-pointer text-center"
        >
          <Clock size={22} className="text-brand-800" />
          <span className="text-[10px] font-bold text-brand-800">پوشه گزارش‌ها</span>
        </button>
      </div>

      {/* 3. Monthly Spending Card */}
      <div id="spending-bar-card" className="border border-line rounded-2xl p-4 flex flex-col gap-3.5 bg-surface shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-ink-800">میزان جذب بودجه سالانه</span>
          <span className="text-[10px] text-ink-500 font-semibold">{expensePercentage}٪ مصرف شده</span>
        </div>

        {/* Custom Progress bar matching design tokens */}
        <div id="spending-progress-bg" className="w-full h-2.5 bg-signal-400 rounded-full overflow-hidden">
          <div 
            id="spending-progress-bar" 
            className="h-full bg-brand-800 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${expensePercentage}%` }}
          />
        </div>

        <div className="flex justify-between items-baseline mt-0.5">
          <p className="text-[10px] text-ink-500">بر اساس اسناد تایید شده دیوان محاسبات</p>
          <span className="text-xs font-bold text-brand-800">
            {totalExpenses.toLocaleString()} میلیون دلار
          </span>
        </div>
      </div>

      {/* Modals for actions */}
      {activeModal === 'deposit' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl p-5 w-full max-w-sm border border-line shadow-xl animate-fade-in text-right">
            <h3 className="text-sm font-bold text-brand-800 mb-3">تزریق نقدینگی فوق‌العاده به خزانه ملی</h3>
            <form onSubmit={handleDepositSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-ink-500">مبلغ فوق‌العاده تزریقی (میلیون دلار)</label>
                <input
                  type="number"
                  required
                  placeholder="مثال: ۵۰۰"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="bg-paper border border-line rounded-lg p-2.5 text-xs text-ink-800 focus:outline-none focus:border-brand-800"
                />
              </div>
              <div className="flex gap-2.5 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-xs bg-paper hover:bg-line text-ink-500 rounded-lg cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs bg-brand-800 hover:bg-brand-700 text-white rounded-lg font-bold cursor-pointer"
                >
                  تأیید و تزریق به خزانه
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeModal === 'transfer' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl p-5 w-full max-w-sm border border-line shadow-xl animate-fade-in text-right">
            <h3 className="text-sm font-bold text-brand-800 mb-3">ثبت و تخصیص سند حواله بودجه</h3>
            <form onSubmit={handleTransferSubmit} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-ink-500">عنوان تخصیص بودجه (بابت چه موضوعی؟)</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: توسعه فیبر نوری استان سمنان"
                  value={transferName}
                  onChange={(e) => setTransferName(e.target.value)}
                  className="bg-paper border border-line rounded-lg p-2.5 text-xs text-ink-800 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-ink-500">وزارت‌خانه یا نهاد دریافت‌کننده حواله</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: وزارت راه و شهرسازی"
                  value={transferRecipient}
                  onChange={(e) => setTransferRecipient(e.target.value)}
                  className="bg-paper border border-line rounded-lg p-2.5 text-xs text-ink-800 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-ink-500">مبلغ تخصیص حواله (میلیون دلار)</label>
                <input
                  type="number"
                  required
                  placeholder="مثال: ۱۵۰"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="bg-paper border border-line rounded-lg p-2.5 text-xs text-ink-800 focus:outline-none"
                />
              </div>
              <div className="flex gap-2.5 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-xs bg-paper hover:bg-line text-ink-500 rounded-lg cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs bg-brand-800 hover:bg-brand-700 text-white rounded-lg font-bold cursor-pointer"
                >
                  تأیید و صدور سند تخصیص
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
