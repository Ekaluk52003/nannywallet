
import React from 'react';
import { Transaction } from '../types';
import { Trash2, Coffee, Home, Car, Heart, ShoppingBag, Briefcase, Gift, Layers } from 'lucide-react';

interface Props {
  transactions: Transaction[];
  onDelete: (id: string) => void;
}

const CategoryIcon: React.FC<{ category: string }> = ({ category }) => {
  const props = { size: 18 };
  switch (category.toLowerCase()) {
    case 'dining out': return <Coffee {...props} />;
    case 'rent/mortgage':
    case 'utilities': return <Home {...props} />;
    case 'transport': return <Car {...props} />;
    case 'health': return <Heart {...props} />;
    case 'shopping': return <ShoppingBag {...props} />;
    case 'salary':
    case 'bonus':
    case 'freelance': return <Briefcase {...props} />;
    case 'gift': return <Gift {...props} />;
    default: return <Layers {...props} />;
  }
};

const TransactionList: React.FC<Props> = ({ transactions, onDelete }) => {
  if (transactions.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
        <p className="text-slate-400 font-medium">No transactions recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-bold text-slate-800">Recent Transactions</h3>
        <span className="text-xs text-slate-400 font-medium">{transactions.length} items</span>
      </div>
      <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
        {transactions.map((t) => (
          <div key={t.id} className="group px-6 py-4 hover:bg-slate-50 transition-all flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${t.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                <CategoryIcon category={t.category} />
              </div>
              <div>
                <p className="font-semibold text-slate-800">{t.description}</p>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter">{t.category}</span>
                  <span>•</span>
                  <span>{new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <p className={`font-bold text-lg ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}>
                {t.type === 'income' ? '+' : '-'}${t.amount.toLocaleString()}
              </p>
              <button 
                onClick={() => onDelete(t.id)}
                className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TransactionList;
