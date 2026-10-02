import { useState, FormEvent, useEffect } from 'react';
import { ArrowUpDown, Plus, Trash2, Maximize2, Minimize2 } from 'lucide-react';
import { BudgetTransaction } from '../types';

interface RecentTransactionsProps {
  transactions: BudgetTransaction[];
  onAddTransaction: (
    name: string,
    category: string,
    recipient: string,
    amount: number,
    type: 'allocation' | 'withdrawal',
    status: 'approved' | 'rejected' | 'review'
  ) => void;
  onDeleteTransaction: (id: string) => void;
  searchQuery: string;
}

export default function RecentTransactions({
  transactions,
  onAddTransaction,
  onDeleteTransaction,
  searchQuery,
}: RecentTransactionsProps) {
  const [filterType, setFilterType] = useState<'all' | 'allocation' | 'withdrawal'>('all');
  const [sortField, setSortField] = useState<keyof BudgetTransaction>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Esc key listener for fullscreen exit and scroll lock
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    if (isFullscreen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  // Interactive Create Transaction Modal
  const [isModalOpen, setIsOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('زیرساخت دیجیتال');
  const [newRecipient, setNewRecipient] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newType, setNewType] = useState<'allocation' | 'withdrawal'>('allocation');
  const [newStatus, setNewStatus] = useState<'approved' | 'rejected' | 'review'>('approved');

  // Form submission
  const handleAddSubmit = (e: FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newAmount);
    if (newName.trim() && newRecipient.trim() && !isNaN(amt) && amt > 0) {
      onAddTransaction(newName, newCategory, newRecipient, amt, newType, newStatus);
      setNewName('');
      setNewRecipient('');
      setNewAmount('');
      setIsOpen(false);
    }
  };

  // Sort toggle handler
  const handleSort = (field: keyof BudgetTransaction) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Filter & Search Logic
  const filteredTransactions = transactions
    .filter((tx) => {
      // Search matches
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        tx.name.toLowerCase().includes(query) ||
        tx.category.toLowerCase().includes(query) ||
        tx.recipient.toLowerCase().includes(query);

      // Type matches
      const matchesType = filterType === 'all' || tx.type === filterType;

      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (typeof a[sortField] === 'string') {
        comparison = (a[sortField] as string).localeCompare(b[sortField] as string);
      } else if (typeof a[sortField] === 'number') {
        comparison = (a[sortField] as number) - (b[sortField] as number);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Helper to color statuses
  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'approved':
        return { text: '#1E4841', bg: '#BBF49C', border: '#ECF4E9', label: 'تایید قطعی' };
      case 'rejected':
        return { text: '#F73541', bg: '#FDCED1', border: '#FDCED1', label: 'مردود دیوان' };
      default:
        return { text: '#F2B007', bg: '#EFF0F0', border: '#E5E6E6', label: 'در حال ارزیابی' };
    }
  };

  const wrapperClass = isFullscreen
    ? "fixed inset-0 z-50 bg-surface p-6 md:p-10 overflow-y-auto flex flex-col gap-6 select-none text-right animate-fade-in"
    : "border border-line bg-surface rounded-2xl p-5 w-full flex flex-col gap-4 shadow-sm select-none text-right";

  return (
    <div id="transactions-section" className={wrapperClass}>
      {/* Header section with category filters and insert button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-ink-800">
            {isFullscreen ? "لیست تفصیلی و تمام‌صفحه اسناد مالی کشور" : "اسناد و تخصیص‌های اخیر بودجه کشور"}
          </h2>
          <span className="text-[10px] bg-brand-100 text-brand-800 px-2.5 py-0.5 rounded-full font-bold">
            {filteredTransactions.length} ردیف سند
          </span>
          {isFullscreen && (
            <span className="text-[10px] bg-warn-soft border border-warn/40 text-warn px-2 py-0.5 rounded-md font-bold animate-pulse">
              حالت تمام‌صفحه فعال (کلید Esc برای خروج)
            </span>
          )}
        </div>

        {/* Tab filters and adding action button */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          <div className="flex bg-paper p-1 rounded-lg">
            <button
              onClick={() => setFilterType('all')}
              className={`text-[10px] px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                filterType === 'all' ? 'bg-surface text-brand-800 shadow-sm' : 'text-ink-500'
              }`}
            >
              کل اسناد بودجه
            </button>
            <button
              onClick={() => setFilterType('allocation')}
              className={`text-[10px] px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                filterType === 'allocation' ? 'bg-surface text-brand-800 shadow-sm' : 'text-ink-500'
              }`}
            >
              تخصیص‌ها و تزریق‌ها
            </button>
            <button
              onClick={() => setFilterType('withdrawal')}
              className={`text-[10px] px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                filterType === 'withdrawal' ? 'bg-surface text-brand-800 shadow-sm' : 'text-ink-500'
              }`}
            >
              برداشت‌ها و مصارف
            </button>
          </div>

          <button
            id="btn-toggle-fullscreen"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 bg-paper hover:bg-line text-brand-800 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
            title={isFullscreen ? "خروج از تمام‌صفحه (Esc)" : "نمایش تمام‌صفحه"}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          <button
            id="btn-new-tx"
            onClick={() => setIsOpen(true)}
            className="p-2 bg-brand-800 hover:bg-brand-700 text-signal-400 rounded-lg transition-colors cursor-pointer"
            title="ثبت سند دستی تراکنش"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Table grid structure in RTL */}
      <div className="w-full overflow-x-auto">
        <table className="w-full text-right text-[11px] border-collapse min-w-[650px]">
          <thead>
            <tr className="bg-brand-100 text-ink-500 font-bold border-b border-line">
              <th className="py-2.5 px-3 rounded-r-lg cursor-pointer hover:text-brand-800" onClick={() => handleSort('name')}>
                <div className="flex items-center gap-1">
                  <span>عنوان سند و حوزه راهبردی</span>
                  <ArrowUpDown size={11} />
                </div>
              </th>
              <th className="py-2.5 px-3 cursor-pointer hover:text-brand-800" onClick={() => handleSort('recipient')}>
                <div className="flex items-center gap-1">
                  <span>سازمان و وزارت‌خانه کارگزار</span>
                  <ArrowUpDown size={11} />
                </div>
              </th>
              <th className="py-2.5 px-3 cursor-pointer hover:text-brand-800" onClick={() => handleSort('amount')}>
                <div className="flex items-center gap-1">
                  <span>مبلغ سند</span>
                  <ArrowUpDown size={11} />
                </div>
              </th>
              <th className="py-2.5 px-3 cursor-pointer hover:text-brand-800" onClick={() => handleSort('date')}>
                <div className="flex items-center gap-1">
                  <span>ثبت دیوان محاسبات</span>
                  <ArrowUpDown size={11} />
                </div>
              </th>
              <th className="py-2.5 px-3 cursor-pointer hover:text-brand-800" onClick={() => handleSort('status')}>
                <div className="flex items-center gap-1">
                  <span>وضعیت حقوقی</span>
                  <ArrowUpDown size={11} />
                </div>
              </th>
              <th className="py-2.5 px-3 rounded-l-lg text-left">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line text-ink-800">
            {filteredTransactions.map((tx) => {
              const bStyle = getStatusBadgeStyle(tx.status);
              return (
                <tr key={tx.id} className="hover:bg-surface transition-colors group">
                  {/* Name and category cells */}
                  <td className="py-3 px-3">
                    <div className="flex flex-col">
                      <span className="font-bold text-ink-800">{tx.name}</span>
                      <span className="text-[9px] text-ink-500 mt-0.5">{tx.category}</span>
                    </div>
                  </td>

                  {/* Recipient */}
                  <td className="py-3 px-3 font-medium">{tx.recipient}</td>

                  {/* Amount with conditional colors */}
                  <td className={`py-3 px-3 font-bold font-mono tracking-tight text-xs ${
                    tx.type === 'allocation' ? 'text-ok' : 'text-ink-800'
                  }`}>
                    {tx.type === 'allocation' ? '+' : '-'}
                    {tx.amount.toLocaleString()} میلیون دلار
                  </td>

                  {/* Date */}
                  <td className="py-3 px-3 text-ink-500 font-mono">{tx.date}</td>

                  {/* Status Badge */}
                  <td className="py-3 px-3">
                    <span 
                      className="px-2.5 py-1 rounded text-[9px] font-bold inline-block border text-center"
                      style={{ 
                        color: bStyle.text, 
                        backgroundColor: bStyle.bg,
                        borderColor: bStyle.border
                      }}
                    >
                      {bStyle.label}
                    </span>
                  </td>

                  {/* Trash/delete action button */}
                  <td className="py-3 px-3 text-left">
                    <button
                      onClick={() => onDeleteTransaction(tx.id)}
                      className="text-ink-300 hover:text-danger p-1.5 rounded-lg transition-colors cursor-pointer"
                      title="ابطال سند"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}

            {filteredTransactions.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-ink-500 text-xs font-semibold">
                  هیچ سند بودجه‌ای منطبق بر معیار جستجو یافت نشد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Persian form modal to create transactions */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl p-5 w-full max-w-sm border border-line shadow-xl animate-fade-in text-right">
            <h3 className="text-sm font-bold text-brand-800 mb-3">ثبت سند جدید تخصیص بودجه ملی</h3>
            <form onSubmit={handleAddSubmit} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-ink-500">شرح یا عنوان تخصیص بودجه</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: احداث آزادراه اصفهان-شیراز"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="bg-paper border border-line rounded-lg p-2.5 text-xs text-ink-800 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-ink-500">حوزه تخصصی و راهبردی</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: بهداشت، دیجیتال، انرژی، رفاه، ترانزیت"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="bg-paper border border-line rounded-lg p-2.5 text-xs text-ink-800 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-ink-500">نهاد دریافت‌کننده یا کارگزار ملی</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: وزارت کشور یا استانداری گیلان"
                  value={newRecipient}
                  onChange={(e) => setNewRecipient(e.target.value)}
                  className="bg-paper border border-line rounded-lg p-2.5 text-xs text-ink-800 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-ink-500">مبلغ تخصیص (میلیون دلار)</label>
                <input
                  type="number"
                  required
                  placeholder="مثال: ۱۵۰"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="bg-paper border border-line rounded-lg p-2.5 text-xs text-ink-800 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-ink-500">نوع سند</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="bg-paper border border-line rounded-lg p-2 text-xs text-ink-800"
                  >
                    <option value="allocation">تخصیص و تزریق بودجه</option>
                    <option value="withdrawal">برداشت و مصرف عملیاتی</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-ink-500">وضعیت دیوان محاسبات</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as any)}
                    className="bg-paper border border-line rounded-lg p-2 text-xs text-ink-800"
                  >
                    <option value="approved">تایید قطعی سند</option>
                    <option value="review">در حال ارزیابی و بررسی</option>
                    <option value="rejected">مردود / کسری مدرک</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2.5 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-xs bg-paper hover:bg-line text-ink-500 rounded-lg cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs bg-brand-800 hover:bg-brand-700 text-white rounded-lg font-bold cursor-pointer"
                >
                  تأیید و صدور سند
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
