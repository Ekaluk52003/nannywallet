import React from 'react';
import { Transaction, TransactionStatus, TransactionType } from '../types';
import { Trash2, Coffee, Home, Car, Heart, ShoppingBag, Briefcase, Gift, Layers, CheckCircle, Calendar, Filter, CreditCard, ArrowDownCircle, Edit2, Play, TrendingUp, Search } from 'lucide-react';
import { MONTHS, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../constants';

interface Props {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onUpdateStatus?: (id: string, newStatus: TransactionStatus) => void;
  onEditTransaction?: (transaction: Transaction) => void;
  filterMonth: number | 'all' | 'custom';
  onMonthChange: (month: number | 'all' | 'custom') => void;
  filterYear: number | 'all';
  onYearChange: (year: number | 'all') => void;
  availableYears: number[];
  startDate?: string;
  endDate?: string;
  onStartDateChange?: (date: string) => void;
  onEndDateChange?: (date: string) => void;
  filterType: 'all' | TransactionType;
  onTypeChange: (type: 'all' | TransactionType) => void;
  filterStatus: 'all' | TransactionStatus;
  onStatusChange: (status: 'all' | TransactionStatus) => void;
  filterCategory: string | 'all';
  onCategoryChange: (category: string | 'all') => void;
  currencySymbol: string;
}

const CategoryIcon: React.FC<{ category: string, size?: number }> = ({ category, size = 16 }) => {
  const props = { size };
  const cat = category.toLowerCase();

  // Expenses
  if (cat.includes('dining') || cat.includes('food')) return <Coffee {...props} />;
  if (cat.includes('rent') || cat.includes('housing') || cat.includes('home') || cat.includes('utilities') || cat.includes('bills')) return <Home {...props} />;
  if (cat.includes('transport') || cat.includes('car')) return <Car {...props} />;
  if (cat.includes('health') || cat.includes('medicine')) return <Heart {...props} />;
  if (cat.includes('shopping') || cat.includes('groceries') || cat.includes('market')) return <ShoppingBag {...props} />;
  if (cat.includes('salary') || cat.includes('freelance') || cat.includes('job') || cat.includes('bonus')) return <Briefcase {...props} />;
  if (cat.includes('gift')) return <Gift {...props} />;
  if (cat.includes('entertainment')) return <Play {...props} />;
  if (cat.includes('subscription')) return <CreditCard {...props} />;

  // Income specific
  if (cat.includes('investment') || cat.includes('stocks')) return <TrendingUp {...props} />;

  return <Layers {...props} />;
};

const CATEGORY_LIST = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

const TransactionList: React.FC<Props> = ({
  transactions,
  onDelete,
  onUpdateStatus,
  onEditTransaction,
  filterMonth,
  onMonthChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  filterType,
  onTypeChange,
  filterStatus,
  onStatusChange,
  filterCategory,
  onCategoryChange,
  currencySymbol,
  filterYear,
  onYearChange,
  availableYears
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredTransactions = React.useMemo(() => {
    if (!searchQuery.trim()) return transactions;
    const query = searchQuery.toLowerCase();
    return transactions.filter(t =>
      t.description.toLowerCase().includes(query) ||
      t.category.toLowerCase().includes(query)
    );
  }, [transactions, searchQuery]);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm transition-all">
      {/* Header & Filters */}
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Transactions</h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.1em] mt-0.5">
              {filterMonth === 'all' ? 'All History' : filterMonth === 'custom' ? 'Custom Range' : `${MONTHS[filterMonth as number]}`} • {filteredTransactions.length} items
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="relative group">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl text-[10px] font-bold text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/20 w-24 sm:w-32 focus:w-48 transition-all placeholder:text-slate-400"
              />
            </div>

            {filterMonth === 'custom' && (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => onStartDateChange?.(e.target.value)}
                  className="px-2 py-1.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl text-[10px] font-bold text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <span className="text-slate-300">-</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => onEndDateChange?.(e.target.value)}
                  className="px-2 py-1.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl text-[10px] font-bold text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            )}

            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-100 dark:border-slate-800">
              <select
                className="bg-transparent text-[11px] font-bold text-slate-600 dark:text-slate-300 outline-none cursor-pointer pl-2"
                value={filterYear}
                onChange={(e) => onYearChange(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
              >
                {availableYears.map(y => (
                  <option key={y} value={y} className="text-slate-900">{y}</option>
                ))}
                <option value="all" className="text-slate-900">All Years</option>
              </select>
              <div className="w-px h-3 bg-slate-200 dark:bg-slate-700"></div>
              <div className="pl-1 text-slate-400 dark:text-slate-500"><Calendar size={12} /></div>
              <select
                className="bg-transparent text-[11px] font-bold text-slate-600 dark:text-slate-300 outline-none cursor-pointer pr-3"
                value={filterMonth}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'all' || val === 'custom') onMonthChange(val);
                  else onMonthChange(parseInt(val));
                }}
              >
                <option value="all" className="text-slate-900">All Months</option>
                <option value="custom" className="text-slate-900">Custom</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i} className="text-slate-900">{m}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-100/50 dark:bg-slate-900/30 px-2.5 py-1 rounded-lg border border-slate-100/50 dark:border-slate-800">
              <Filter size={10} className="text-slate-400" />
              <select
                className="bg-transparent text-[9px] font-black text-slate-500 dark:text-slate-400 outline-none cursor-pointer uppercase tracking-wider"
                value={filterType}
                onChange={(e) => {
                  onTypeChange(e.target.value as any);
                  onCategoryChange('all');
                }}
              >
                <option value="all" className="text-slate-900">All Types</option>
                <option value="income" className="text-slate-900">Income</option>
                <option value="expense" className="text-slate-900">Expense</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100/50 dark:bg-slate-900/30 px-2.5 py-1 rounded-lg border border-slate-100/50 dark:border-slate-800">
              <CheckCircle size={10} className="text-slate-400" />
              <select
                className="bg-transparent text-[9px] font-black text-slate-500 dark:text-slate-400 outline-none cursor-pointer uppercase tracking-wider"
                value={filterStatus}
                onChange={(e) => onStatusChange(e.target.value as any)}
              >
                <option value="all" className="text-slate-900">All Status</option>
                <option value="paid" className="text-slate-900">Paid/Received</option>
                <option value="pending" className="text-slate-900">Pending</option>
              </select>
            </div>
          </div>

          {/* Compact Category Icon Filter Area */}
          <div className="flex-1 flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar w-full sm:w-auto">
            <button
              onClick={() => onCategoryChange('all')}
              className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[8px] font-black uppercase transition-all ${filterCategory === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 dark:bg-slate-900 text-slate-400 hover:bg-slate-100'}`}
              title="All"
            >
              All
            </button>
            {(filterType === 'income' ? INCOME_CATEGORIES : filterType === 'expense' ? EXPENSE_CATEGORIES : CATEGORY_LIST).map(cat => (
              <button
                key={cat}
                onClick={() => onCategoryChange(cat)}
                className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all ${filterCategory === cat ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 dark:bg-slate-900 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                title={cat}
              >
                <CategoryIcon category={cat} size={14} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Transaction Rows */}
      <div className="divide-y divide-slate-100 dark:divide-slate-700/50 max-h-[500px] overflow-y-auto custom-scrollbar">
        {filteredTransactions.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center">
            <div className="p-5 rounded-full bg-slate-50 dark:bg-slate-900 mb-3 text-slate-200 dark:text-slate-800">
              <Layers size={40} />
            </div>
            <p className="text-slate-400 dark:text-slate-500 text-xs font-medium">No transactions found</p>
          </div>
        ) : (
          filteredTransactions.map((t) => (
            <div
              key={t.id}
              onClick={() => onEditTransaction?.(t)}
              className="group px-4 sm:px-6 py-3 sm:py-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-all flex items-start sm:items-center gap-3 sm:gap-4 cursor-pointer"
            >
              {/* Zone 1: Icon */}
              <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${t.status === 'pending'
                ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                : (t.type === 'income' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300')
                }`}>
                <CategoryIcon category={t.category} size={18} />
              </div>

              {/* Wrapper for Details & Financials */}
              <div className="flex-grow flex flex-col sm:flex-row sm:items-center min-w-0 gap-2 sm:gap-4">
                {/* Zone 2: Details */}
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-bold text-[13px] text-slate-800 dark:text-slate-200 truncate">{t.description}</p>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    <span>{t.category}</span>
                    <span className="opacity-30">•</span>
                    <span>{new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>

                {/* Zone 3: Financials & Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto pl-1 sm:pl-0">
                  <div className="text-left sm:text-right sm:min-w-[90px]">
                    <p className={`font-black text-sm leading-tight ${t.type === 'income'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : (t.status === 'pending' ? 'text-amber-600 dark:text-amber-500' : 'text-slate-800 dark:text-slate-200')
                      }`}>
                      {t.type === 'income' ? '+' : '-'}{currencySymbol}{t.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    {t.status === 'pending' && (
                      <p className="text-[8px] font-black text-amber-500/80 uppercase tracking-widest mt-0.5">Pending</p>
                    )}
                  </div>

                  <div
                    className="flex items-center gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {t.status === 'pending' ? (
                      <button
                        onClick={() => onUpdateStatus?.(t.id, 'paid')}
                        className="flex items-center gap-1.5 h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-black rounded-lg shadow-sm active:scale-95 transition-all uppercase whitespace-nowrap"
                      >
                        {t.type === 'expense' ? <CreditCard size={12} /> : <ArrowDownCircle size={12} />}
                        {t.type === 'expense' ? 'Pay' : 'Receive'}
                      </button>
                    ) : (
                      <button
                        onClick={() => onUpdateStatus?.(t.id, 'pending')}
                        className="w-8 h-8 flex items-center justify-center text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all"
                        title="Mark as Pending"
                      >
                        <CheckCircle size={16} />
                      </button>
                    )}

                    <button
                      onClick={() => onDelete(t.id)}
                      className="w-8 h-8 flex items-center justify-center text-slate-300 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/50 rounded-lg transition-all"
                    >
                      <Trash2 size={16} />
                    </button>

                    <div className="hidden sm:flex items-center opacity-0 group-hover:opacity-40 transition-opacity pl-1">
                      <Edit2 size={12} className="text-slate-400" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TransactionList;
