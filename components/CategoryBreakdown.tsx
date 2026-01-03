
import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType } from '../types';
import { PieChart, TrendingDown, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  transactions: Transaction[];
  currencySymbol: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  // Expenses
  'Rent/Housing': '#6366f1',
  'Groceries': '#10b981',
  'Dining Out': '#f59e0b',
  'Utilities/Bills': '#3b82f6',
  'Transportation': '#8b5cf6',
  'Entertainment': '#ec4899',
  'Health/Medicine': '#ef4444',
  'Shopping': '#f43f5e',
  'Subscription': '#06b6d4',
  'Other Expense': '#94a3b8',

  // Income
  'Salary': '#10b981',
  'Bonus': '#34d399',
  'Investment': '#60a5fa',
  'Freelance': '#818cf8',
  'Gift': '#f472b6',
  'Other Income': '#94a3b8'
};

const CategoryBreakdown: React.FC<Props> = ({ transactions, currencySymbol }) => {
  const [viewType, setViewType] = useState<TransactionType>('expense');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const stats = useMemo(() => {
    const filtered = transactions.filter(t => t.type === viewType);
    const total = filtered.reduce((sum, t) => sum + t.amount, 0);

    const breakdown = filtered.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(breakdown)
      .map(([category, amount]: [string, number]) => ({
        category,
        amount,
        percentage: total > 0 ? (amount / total) * 100 : 0,
        color: CATEGORY_COLORS[category] || '#cbd5e1'
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [transactions, viewType]);

  const totalAmount = stats.reduce((sum, s) => sum + s.amount, 0);

  let cumulativePercentage = 0;
  const pieSegments = stats.map((s) => {
    const start = cumulativePercentage;
    cumulativePercentage += s.percentage;
    return { ...s, start };
  });

  return (
    <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm transition-all overflow-hidden">
      <div className="p-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PieChart size={18} className="text-indigo-500" />
          <h3 className="font-bold text-slate-800 dark:text-slate-100">
            {viewType === 'expense' ? 'Expenses' : 'Income'} Breakdown
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewType(viewType === 'expense' ? 'income' : 'expense')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border ${viewType === 'expense' ? 'bg-rose-500 border-rose-400 text-white' : 'bg-emerald-500 border-emerald-400 text-white'}`}
          >
            {viewType === 'expense' ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
            {viewType === 'expense' ? 'View Income' : 'View Expense'}
          </button>
          <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-2 text-slate-400">
            {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="px-6 pb-8 pt-2">
          {totalAmount > 0 ? (
            <div className="flex flex-col gap-6 items-center">
              <div className="relative">
                <svg viewBox="0 0 100 100" className="w-40 h-40 -rotate-90">
                  {pieSegments.map((s, i) => (
                    <circle
                      key={i}
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke={s.color}
                      strokeWidth="12"
                      strokeDasharray={`${(s.percentage * 251.2) / 100} 251.2`}
                      strokeDashoffset={`${-(s.start * 251.2) / 100}`}
                      className="transition-all duration-700"
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</span>
                  <span className="text-sm font-black text-slate-800 dark:text-white">{currencySymbol}{totalAmount.toLocaleString()}</span>
                </div>
              </div>

              <div className="w-full space-y-2.5 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                {stats.map((s, i) => (
                  <div key={i} className="flex items-center justify-between group">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }}></div>
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate max-w-[140px]">
                        {s.category}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-black text-slate-800 dark:text-slate-200">
                        {currencySymbol}{s.amount.toLocaleString()}
                      </p>
                      <p className="text-[9px] text-slate-400 font-bold">{s.percentage.toFixed(1)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-slate-400 text-sm font-medium">No data for this category</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CategoryBreakdown;
