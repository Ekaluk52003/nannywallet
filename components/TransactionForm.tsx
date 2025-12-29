
import React, { useState, useEffect } from 'react';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '../constants';
import { Transaction, TransactionType, TransactionStatus } from '../types';
import { PlusCircle, CheckCircle, Clock, X, Save } from 'lucide-react';

interface Props {
  onAdd: (transaction: Transaction) => void;
  onUpdate?: (transaction: Transaction) => void;
  initialData?: Transaction;
  onClose?: () => void;
}

const TransactionForm: React.FC<Props> = ({ onAdd, onUpdate, initialData, onClose }) => {
  const [type, setType] = useState<TransactionType>(initialData?.type || 'expense');
  const [amount, setAmount] = useState(initialData?.amount?.toString() || '');
  const [category, setCategory] = useState(initialData?.category || EXPENSE_CATEGORIES[0]);
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState(initialData?.description || '');
  const [status, setStatus] = useState<TransactionStatus>(initialData?.status || 'paid');

  const isEditing = !!initialData;

  useEffect(() => {
    if (initialData) {
      setType(initialData.type);
      setAmount(initialData.amount.toString());
      setCategory(initialData.category);
      setDate(initialData.date);
      setDescription(initialData.description);
      setStatus(initialData.status);
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      alert("กรุณากรอกจำนวนเงินที่ถูกต้อง");
      return;
    }

    const tx: Transaction = {
      id: initialData?.id || crypto.randomUUID(),
      type,
      amount: parseFloat(amount),
      category,
      date,
      description: description || category,
      status
    };

    if (isEditing && onUpdate) {
      onUpdate(tx);
    } else {
      onAdd(tx);
    }
    
    if (!isEditing) {
      setAmount('');
      setDescription('');
      setStatus('paid');
    }
  };

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    if (!isEditing || newType !== initialData?.type) {
      setCategory(newType === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]);
    } else {
      setCategory(initialData.category);
    }
  };

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-700 transition-colors w-full overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
          {isEditing ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่'}
        </h3>
        {onClose && (
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors sm:hidden">
            <X size={20} className="text-slate-400" />
          </button>
        )}
      </div>
      
      <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl mb-6">
        <button
          type="button"
          onClick={() => handleTypeChange('expense')}
          className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${type === 'expense' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
        >
          รายจ่าย
        </button>
        <button
          type="button"
          onClick={() => handleTypeChange('income')}
          className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${type === 'income' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
        >
          รายรับ
        </button>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">จำนวนเงิน</label>
          <div className="relative">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xl">฿</span>
            <input
              type="number"
              required
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-2xl text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">หมวดหมู่</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-bold text-slate-900 dark:text-white appearance-none cursor-pointer"
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">วันที่</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-bold text-slate-900 dark:text-white cursor-pointer"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">สถานะ</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStatus('paid')}
              className={`flex-1 flex items-center justify-center gap-2 py-4 px-3 rounded-2xl border-2 text-xs font-bold transition-all ${status === 'paid' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 text-slate-400'}`}
            >
              <CheckCircle size={16} /> {type === 'expense' ? 'จ่ายแล้ว' : 'รับแล้ว'}
            </button>
            <button
              type="button"
              onClick={() => setStatus('pending')}
              className={`flex-1 flex items-center justify-center gap-2 py-4 px-3 rounded-2xl border-2 text-xs font-bold transition-all ${status === 'pending' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-500 text-amber-600 dark:text-amber-400' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 text-slate-400'}`}
            >
              <Clock size={16} /> {type === 'expense' ? 'ค้างจ่าย' : 'ค้างรับ'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">คำอธิบาย</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="เช่น ค่าอาหารกลางวัน"
            className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-medium text-slate-900 dark:text-white"
          />
        </div>

        <div className="pt-2">
          <button 
            type="submit"
            className={`w-full flex items-center justify-center gap-3 py-5 rounded-2xl font-bold transition-all shadow-xl active:scale-95 ${type === 'income' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
          >
            {isEditing ? <Save size={20} /> : <PlusCircle size={20} />}
            {isEditing ? 'บันทึกการแก้ไข' : `บันทึก${type === 'income' ? 'รายรับ' : 'รายจ่าย'}`}
          </button>
        </div>
      </div>
    </form>
  );
};

export default TransactionForm;
