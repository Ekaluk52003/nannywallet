import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import TransactionForm from '../components/TransactionForm';
import TransactionList from '../components/TransactionList';
import CategoryBreakdown from '../components/CategoryBreakdown';
import { processVoiceCommand } from '../services/geminiService';
import {
  getTransactions,
  appendTransaction,
  deleteTransaction,
  updateTransaction,
  listWallets,
  createWallet,
  SheetTransaction,
  Wallet as WalletType
} from '../services/googleSheetsService';
import { Transaction, TransactionStatus, TransactionType } from '../types';
import {
  Wallet, TrendingUp, TrendingDown, Sparkles, RefreshCw,
  Settings, CheckCircle2, Moon, Sun, Mic, Square, Loader2,
  Key, Calendar, Plus, X, LogOut, User, ChevronDown, PlusCircle, Menu, ExternalLink
} from 'lucide-react';
import { MONTHS, CURRENCIES } from '../constants';

const DashboardPage: React.FC = () => {
  const { user, accessToken, logout } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Wallets
  const [wallets, setWallets] = useState<WalletType[]>([]);
  const [currentWallet, setCurrentWallet] = useState<WalletType | null>(null);
  const [isWalletDropdownOpen, setIsWalletDropdownOpen] = useState(false);
  const [isCreateWalletModalOpen, setIsCreateWalletModalOpen] = useState(false);
  const [newWalletName, setNewWalletName] = useState('');
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);

  // Settings & UI State
  const [geminiApiKey, setGeminiApiKey] = useState(localStorage.getItem('wealth_gemini_key') || '');
  const [showSettings, setShowSettings] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(localStorage.getItem('theme') === 'dark');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Filter States
  const [filterMonth, setFilterMonth] = useState<number | 'all' | 'custom'>(new Date().getMonth());
  const [filterYear, setFilterYear] = useState<number | 'all'>(new Date().getFullYear());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterType, setFilterType] = useState<'all' | TransactionType>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | TransactionStatus>('all');
  const [filterCategory, setFilterCategory] = useState<string | 'all'>('all');

  // Voice Recording State
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'listening' | 'processing'>('idle');

  // Currency State
  const [currencyCode, setCurrencyCode] = useState(localStorage.getItem('currency_code') || 'THB');
  const currencySymbol = CURRENCIES.find(c => c.code === currencyCode)?.symbol || '฿';
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const availableYears = useMemo(() => {
    const years = new Set([new Date().getFullYear()]);
    transactions.forEach(t => {
      const parts = t.date.split('-');
      if (parts[0]) years.add(parseInt(parts[0]));
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions]);

  // Theme Effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Initial Wallet Load
  const isInitRef = useRef(false);

  useEffect(() => {
    const initWallets = async () => {
      if (!accessToken || isInitRef.current) return;
      isInitRef.current = true;

      setIsLoading(true);
      try {
        const fetchedWallets = await listWallets(accessToken);
        setWallets(fetchedWallets);

        if (fetchedWallets.length > 0) {
          // Try to find last used wallet
          const lastWalletId = localStorage.getItem('last_wallet_id');
          const foundWallet = fetchedWallets.find(w => w.id === lastWalletId);
          const activeWallet = foundWallet || fetchedWallets[0];
          setCurrentWallet(activeWallet);
          localStorage.setItem('last_wallet_id', activeWallet.id);
        } else {
          // No wallets, create default
          await handleCreateWallet('Personal');
        }
      } catch (error) {
        console.error("Failed to list wallets", error);
        alert("Failed to fetch wallets");
      } finally {
        setIsLoading(false);
      }
    };
    initWallets();
  }, [accessToken]);

  // Load Data when Current Wallet Changes
  const loadData = async () => {
    if (!accessToken || !currentWallet) {
      return;
    }
    console.log("Starting loadData for wallet:", currentWallet.name);
    setIsLoading(true);
    try {
      const sheetData = await getTransactions(accessToken, currentWallet.id);
      console.log("Fetched transactions:", sheetData);
      const mappedTransactions: Transaction[] = sheetData.map(t => ({
        id: t.id,
        date: t.date,
        category: t.category,
        type: t.type as TransactionType,
        amount: Number(t.amount),
        description: t.description,
        status: t.status as TransactionStatus
      }));
      // Sort by date descending
      setTransactions(mappedTransactions.sort((a, b) => b.date.localeCompare(a.date)));
    } catch (error) {
      console.error("Failed to load transactions", error);
      alert("Failed to fetch transactions");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentWallet) {
      loadData();
    }
  }, [currentWallet, accessToken]);

  const handleCreateWallet = async (name: string) => {
    if (!accessToken) return;
    setIsCreatingWallet(true);
    try {
      const newWallet = await createWallet(accessToken, name);
      setWallets(prev => [...prev, newWallet]);
      setCurrentWallet(newWallet);
      localStorage.setItem('last_wallet_id', newWallet.id);
      setIsCreateWalletModalOpen(false);
      setNewWalletName('');
    } catch (error) {
      console.error("Failed to create wallet", error);
      alert("Failed to create wallet");
    } finally {
      setIsCreatingWallet(false);
    }
  };

  const handleSwitchWallet = (wallet: WalletType) => {
    setCurrentWallet(wallet);
    localStorage.setItem('last_wallet_id', wallet.id);
    setIsWalletDropdownOpen(false);
  };

  const handleAddTransaction = async (t: Transaction) => {
    if (!accessToken || !currentWallet) return;

    // Optimistic Update
    setTransactions(prev => [t, ...prev]);
    setIsAddModalOpen(false);

    try {
      const sheetTx: SheetTransaction = {
        id: t.id,
        date: t.date,
        category: t.category,
        type: t.type,
        amount: t.amount,
        description: t.description,
        status: t.status
      };
      await appendTransaction(accessToken, currentWallet.id, sheetTx);
    } catch (error) {
      console.error("Failed to add transaction", error);
      alert("Failed to save to Google Sheet, but displayed locally.");
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    if (!accessToken || !currentWallet) return;

    // Optimistic Update
    setTransactions(prev => prev.filter(t => t.id !== id));

    try {
      await deleteTransaction(accessToken, currentWallet.id, id);
    } catch (error) {
      console.error("Failed to delete transaction", error);
      alert("Failed to delete from Google Sheet");
    }
  };

  const handleUpdateTransaction = async (t: Transaction) => {
    if (!accessToken || !currentWallet) return;

    setTransactions(prev => prev.map(item => item.id === t.id ? t : item));
    setEditingTransaction(null);

    try {
      const sheetTx: SheetTransaction = {
        id: t.id,
        date: t.date,
        category: t.category,
        type: t.type,
        amount: t.amount,
        description: t.description,
        status: t.status
      };
      await updateTransaction(accessToken, currentWallet.id, sheetTx);
    } catch (error) {
      console.error("Failed to update transaction", error);
      alert("Failed to update Google Sheet");
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: TransactionStatus) => {
    if (!accessToken || !currentWallet) return;
    const today = new Date().toISOString().split('T')[0];

    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    const updatedTx = {
      ...tx,
      status: newStatus,
      date: newStatus === 'paid' ? today : tx.date
    };

    setTransactions(prev => prev.map(t => t.id === id ? updatedTx : t));

    try {
      const sheetTx: SheetTransaction = {
        id: updatedTx.id,
        date: updatedTx.date,
        category: updatedTx.category,
        type: updatedTx.type,
        amount: updatedTx.amount,
        description: updatedTx.description,
        status: updatedTx.status
      };
      await updateTransaction(accessToken, currentWallet.id, sheetTx);
    } catch (error) {
      console.error("Failed to update status", error);
    }
  };

  // --- Voice Logic (Preserved) ---
  const startRecording = async () => {
    if (!geminiApiKey) {
      alert("Please provide Gemini API Key in settings to use Voice Assistant");
      setShowSettings(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setVoiceStatus('listening');
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Cannot access microphone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && voiceStatus === 'listening') {
      setVoiceStatus('processing');
      mediaRecorderRef.current.stop();
    }
  };

  const processAudio = async (blob: Blob) => {
    setVoiceStatus('processing');
    try {
      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          if (typeof reader.result === 'string') resolve(reader.result.split(',')[1]);
          else reject(new Error('Failed to convert audio'));
        };
        reader.onerror = reject;
      });

      const result = await processVoiceCommand(geminiApiKey, base64Audio, 'audio/webm');

      if (result && result.amount) {
        const newTx: Transaction = {
          id: crypto.randomUUID(),
          type: (result.type as any) || 'expense',
          amount: result.amount,
          category: result.category || 'Other Expense',
          date: result.date || new Date().toISOString().split('T')[0],
          description: result.description || 'Voice Record',
          status: result.status || 'paid'
        };
        await handleAddTransaction(newTx);
      } else {
        alert("Voice command not understood");
      }
    } catch (error) {
      console.error("Error processing audio:", error);
      alert("Error processing audio");
    } finally {
      setVoiceStatus('idle');
    }
  };

  // --- Calculations ---
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      let dateMatch = true;
      if (filterMonth === 'custom') {
        if (startDate && t.date < startDate) dateMatch = false;
        if (endDate && t.date > endDate) dateMatch = false;
      } else {
        const parts = t.date.split('-');
        if (parts.length >= 2) {
          const tYear = parseInt(parts[0], 10);
          const tMonth = parseInt(parts[1], 10) - 1;

          if (filterYear !== 'all' && tYear !== filterYear) dateMatch = false;
          if (filterMonth !== 'all' && tMonth !== filterMonth) dateMatch = false;
        }
      }
      const typeMatch = filterType === 'all' || t.type === filterType;
      const statusMatch = filterStatus === 'all' || t.status === filterStatus;
      const categoryMatch = filterCategory === 'all' || t.category === filterCategory;
      return dateMatch && typeMatch && statusMatch && categoryMatch;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, filterMonth, filterYear, startDate, endDate, filterType, filterStatus, filterCategory]);

  const monthFilteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (filterMonth === 'custom') {
        if (startDate && t.date < startDate) return false;
        if (endDate && t.date > endDate) return false;
        return true;
      }

      const parts = t.date.split('-');
      const tYear = parseInt(parts[0], 10);
      const tMonth = parseInt(parts[1], 10) - 1;

      if (filterYear !== 'all' && tYear !== filterYear) return false;
      if (filterMonth !== 'all' && tMonth !== filterMonth) return false;

      return true;
    });
  }, [transactions, filterMonth, filterYear, startDate, endDate]);

  const totals = useMemo(() => {
    const acc = monthFilteredTransactions.reduce((acc, t) => {
      const amount = t.amount;
      if (t.type === 'income') {
        acc.income += amount;
        if (t.status === 'paid') acc.paidIncome += amount;
        else acc.pendingIncome += amount;
      } else {
        acc.expense += amount;
        if (t.status === 'paid') acc.paidExpense += amount;
        else acc.pendingExpense += amount;
      }
      return acc;
    }, { income: 0, expense: 0, paidIncome: 0, paidExpense: 0, pendingIncome: 0, pendingExpense: 0 });

    return { ...acc, net: acc.income - acc.expense };
  }, [monthFilteredTransactions]);

  // --- Render ---
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors pb-12 font-sans">
      <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 transition-colors">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Mobile Sidebar Toggle */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 mr-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Menu size={20} />
            </button>

            <div className="p-2 bg-indigo-600 rounded-lg text-white">
              <Wallet size={20} />
            </div>

            {/* Wallet Selector */}
            <div className="relative">
              <button
                onClick={() => setIsWalletDropdownOpen(!isWalletDropdownOpen)}
                className="flex flex-col items-start hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded-lg transition-colors group"
              >
                <span className="font-bold text-base text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1">
                  {currentWallet ? currentWallet.name : 'Loading...'}
                  <ChevronDown size={14} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                </span>
                <span className="text-[10px] text-indigo-500 font-medium -mt-1">Nanywallet Wallet</span>
              </button>

              {isWalletDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsWalletDropdownOpen(false)}></div>
                  <div className="absolute left-0 top-full mt-2 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Your Wallets</p>
                    </div>
                    <div className="max-h-48 overflow-y-auto custom-scrollbar">
                      {wallets.map(w => (
                        <button
                          key={w.id}
                          onClick={() => handleSwitchWallet(w)}
                          className={`w-full text-left flex items-center justify-between px-3 py-2.5 rounded-lg text-sm mb-1 ${currentWallet?.id === w.id
                            ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-semibold'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                        >
                          <span className="truncate">{w.name}</span>
                          {currentWallet?.id === w.id && <CheckCircle2 size={14} />}
                        </button>
                      ))}
                    </div>
                    <div className="pt-2 mt-1 border-t border-slate-100 dark:border-slate-800 space-y-1">
                      {currentWallet && (
                        <a
                          href={`https://docs.google.com/spreadsheets/d/${currentWallet.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-sm text-emerald-600 font-medium"
                        >
                          <ExternalLink size={16} /> Open in Google Sheets
                        </a>
                      )}

                      <button
                        onClick={() => { setIsWalletDropdownOpen(false); setIsCreateWalletModalOpen(true); }}
                        className="w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-sm text-indigo-600 font-medium"
                      >
                        <PlusCircle size={16} /> New Wallet
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-3">
            <button
              onClick={loadData}
              disabled={isLoading}
              className={`p-2 rounded-xl transition-colors ${isLoading ? 'animate-spin text-indigo-500' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500'}`}
              title="Refresh Data"
            >
              <RefreshCw size={20} />
            </button>
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
              >
                {user?.picture ? (
                  <img
                    src={user.picture}
                    alt={user.name}
                    className="w-7 h-7 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <User size={20} className="text-slate-500" />
                )}
              </button>

              {isProfileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)}></div>
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                      <p className="text-sm font-bold truncate">{user?.name}</p>
                      <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                    </div>
                    <button onClick={() => { setShowSettings(!showSettings); setIsProfileOpen(false); }} className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-sm text-slate-600 dark:text-slate-300">
                      <Settings size={14} /> Settings
                    </button>
                    <button onClick={() => { logout(); setIsProfileOpen(false); }} className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-sm text-rose-600">
                      <LogOut size={14} /> Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Create Wallet Modal */}
      {isCreateWalletModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsCreateWalletModalOpen(false)}></div>
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold mb-4">Create New Wallet</h3>
            <input
              type="text"
              placeholder="Wallet Name (e.g. Family, Personal)"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all mb-4"
              value={newWalletName}
              onChange={(e) => setNewWalletName(e.target.value)}
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setIsCreateWalletModalOpen(false)} className="flex-1 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium">Cancel</button>
              <button
                onClick={() => handleCreateWallet(newWalletName || 'New Wallet')}
                disabled={isCreatingWallet || !newWalletName.trim()}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isCreatingWallet && <Loader2 size={16} className="animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 animate-in slide-in-from-top duration-300">
          <div className="max-w-5xl mx-auto px-6 py-8">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Settings size={18} className="text-indigo-500" />
              Settings
            </h3>
            <div className="max-w-md">
              <label className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
                <Key size={12} /> Gemini AI API Key (For Voice Assistant)
              </label>
              <input
                type="password"
                placeholder="Enter your API Key..."
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                value={geminiApiKey}
                onChange={(e) => { setGeminiApiKey(e.target.value); localStorage.setItem('wealth_gemini_key', e.target.value); }}
              />
              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Currency</label>
                <div className="grid grid-cols-2 gap-2">
                  {CURRENCIES.map(c => (
                    <button
                      key={c.code}
                      onClick={() => {
                        setCurrencyCode(c.code);
                        localStorage.setItem('currency_code', c.code);
                      }}
                      className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${currencyCode === c.code
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-300'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                    >
                      <span className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-900 rounded-lg shadow-sm font-bold text-sm">
                        {c.symbol}
                      </span>
                      <div className="text-left">
                        <p className="font-bold text-xs">{c.code}</p>
                        <p className="text-[10px] opacity-60 truncate max-w-[80px]">{c.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setShowSettings(false)}
                className="mt-6 w-full py-3 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 dark:shadow-none"
              >
                Close Settings
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Stats */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-indigo-600 dark:bg-indigo-700 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden transition-all group">
            {/* Stats Content - Same as before but cleaned up */}
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <div className="space-y-0.5">
                  <p className="text-indigo-100/70 text-[10px] font-bold uppercase tracking-widest">Net Balance</p>
                  <p className="text-white text-xs font-semibold">
                    {filterMonth === 'all' ? 'All' : filterMonth === 'custom' ? 'Custom' : `${MONTHS[filterMonth as number]}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 backdrop-blur-md">
                  <select
                    className="bg-transparent text-[10px] font-bold text-white outline-none cursor-pointer"
                    value={filterYear}
                    onChange={(e) => setFilterYear(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                  >
                    {availableYears.map(y => (
                      <option key={y} value={y} className="text-slate-900">{y}</option>
                    ))}
                    <option value="all" className="text-slate-900">All Years</option>
                  </select>
                  <div className="w-px h-3 bg-white/20"></div>
                  <Calendar size={12} className="text-white/60" />
                  <select
                    className="bg-transparent text-[10px] font-bold text-white outline-none cursor-pointer"
                    value={filterMonth}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'all' || val === 'custom') setFilterMonth(val);
                      else setFilterMonth(parseInt(val));
                    }}
                  >
                    <option value="all" className="text-slate-900">All</option>
                    <option value="custom" className="text-slate-900">Custom</option>
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i} className="text-slate-900">{m}</option>
                    ))}
                  </select>
                </div>
              </div>
              <h2 className="text-4xl font-bold mb-4 tracking-tight">
                <span className="text-2xl font-normal mr-1 opacity-80">{currencySymbol}</span>
                {(totals.income - totals.expense).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h2>

              <div className="space-y-3">
                <div className="flex items-center justify-between bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 group-hover:bg-white/15 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-400/20 rounded-lg text-emerald-300">
                      <TrendingUp size={18} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">Total Income</span>
                    </div>
                  </div>
                  <p className="font-bold text-lg">{currencySymbol}{totals.income.toLocaleString()}</p>
                </div>

                <div className="flex items-center justify-between bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 group-hover:bg-white/15 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-400/20 rounded-lg text-rose-300">
                      <TrendingDown size={18} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-100">Total Expense</span>
                    </div>
                  </div>
                  <p className="font-bold text-lg">{currencySymbol}{totals.expense.toLocaleString()}</p>
                </div>
              </div>

              <div className="mt-8">
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="w-full flex items-center justify-center gap-3 py-4 bg-white text-indigo-600 font-bold rounded-2xl shadow-xl hover:bg-indigo-50 active:scale-95 transition-all"
                >
                  <Plus size={20} /> Add Transaction
                </button>
              </div>
            </div>
          </div>
          <CategoryBreakdown transactions={monthFilteredTransactions} currencySymbol={currencySymbol} />
        </div>

        {/* Right Column: Transactions & Voice */}
        <div className="lg:col-span-2 space-y-6">
          {/* Voice Assistant */}
          {geminiApiKey && (
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 dark:from-indigo-800 dark:to-purple-900 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden transition-all">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm"><Mic size={24} /></div>
                    <div>
                      <h3 className="text-xl font-bold">AI Voice Assistant</h3>
                      <p className="text-indigo-100/80 text-xs">Record transactions by voice (Thai supported)</p>
                    </div>
                  </div>
                  {voiceStatus === 'processing' && <Loader2 size={24} className="animate-spin text-white/50" />}
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/10 mb-6 text-center shadow-inner">
                  {voiceStatus === 'listening' ? (
                    <div className="space-y-4 py-2">
                      <p className="text-sm font-medium animate-pulse">Listening...</p>
                      <button onClick={stopRecording} className="mx-auto flex items-center gap-2 px-8 py-3 bg-rose-500 hover:bg-rose-600 rounded-2xl font-bold shadow-lg"><Square size={18} /> Stop</button>
                    </div>
                  ) : (
                    <div className="space-y-4 py-2">
                      <p className="text-sm text-indigo-50 italic opacity-80 leading-relaxed">
                        "Lunch 50 baht" or "Salary 30000"
                      </p>
                      <button
                        onClick={startRecording}
                        disabled={voiceStatus === 'processing'}
                        className="mx-auto flex items-center gap-3 px-10 py-4 bg-white text-indigo-600 hover:bg-indigo-50 rounded-2xl font-bold shadow-lg disabled:opacity-50 active:scale-95 transition-all"
                      >
                        <Mic size={22} /> Tap to Speak
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <TransactionList
            transactions={filteredTransactions}
            onDelete={handleDeleteTransaction}
            onUpdateStatus={handleUpdateStatus}
            onEditTransaction={setEditingTransaction}
            filterMonth={filterMonth}
            onMonthChange={setFilterMonth}
            filterYear={filterYear}
            onYearChange={setFilterYear}
            availableYears={availableYears}
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            filterType={filterType}
            onTypeChange={setFilterType}
            filterStatus={filterStatus}
            onStatusChange={setFilterStatus}
            filterCategory={filterCategory}
            onCategoryChange={setFilterCategory}
            currencySymbol={currencySymbol}
          />
        </div>
      </main>

      {/* Modals */}
      {(isAddModalOpen || editingTransaction) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => { setIsAddModalOpen(false); setEditingTransaction(null); }}
          />
          <div className="relative w-full max-w-lg animate-in zoom-in-95 duration-200">
            <button
              onClick={() => { setIsAddModalOpen(false); setEditingTransaction(null); }}
              className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
            <TransactionForm
              onAdd={handleAddTransaction}
              onUpdate={handleUpdateTransaction}
              initialData={editingTransaction || undefined}
              onClose={() => { setIsAddModalOpen(false); setEditingTransaction(null); }}
              currencySymbol={currencySymbol}
            />
          </div>
        </div>
      )}

      {/* Mobile Sidebar */}
      {isSidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden animate-in fade-in duration-300"
            onClick={() => setIsSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-900 shadow-2xl transform transition-transform duration-300 ease-in-out lg:hidden animate-in slide-in-from-left">
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-600 rounded-lg text-white">
                    <Wallet size={20} />
                  </div>
                  <span className="font-bold text-lg text-slate-800 dark:text-slate-100">Nanywallet</span>
                </div>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* User Profile */}
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                  {user?.picture ? (
                    <img src={user.picture} alt={user.name} className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-300">
                      <User size={20} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">{user?.name}</p>
                    <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                  </div>
                </div>

                {/* Navigation */}
                <div className="space-y-1">
                  <p className="px-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Main Menu</p>
                  <button onClick={() => setIsSidebarOpen(false)} className="w-full flex items-center gap-3 px-3 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 rounded-lg font-medium">
                    <TrendingUp size={18} /> Overview
                  </button>
                  <button onClick={() => { setIsSidebarOpen(false); setIsCreateWalletModalOpen(true); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg font-medium transition-colors">
                    <PlusCircle size={18} /> New Wallet
                  </button>
                  {currentWallet && (
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${currentWallet.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg font-medium transition-colors"
                      onClick={() => setIsSidebarOpen(false)}
                    >
                      <ExternalLink size={18} /> Open in Google Sheets
                    </a>
                  )}
                </div>

                {/* Wallets */}
                <div className="space-y-1">
                  <p className="px-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Wallets</p>
                  {wallets.map(w => (
                    <button
                      key={w.id}
                      onClick={() => { handleSwitchWallet(w); setIsSidebarOpen(false); }}
                      className={`w-full flex items-center justified-between px-3 py-2.5 rounded-lg font-medium transition-colors ${currentWallet?.id === w.id
                        ? 'text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <Wallet size={16} />
                        <span className="truncate">{w.name}</span>
                      </div>
                      {currentWallet?.id === w.id && <CheckCircle2 size={16} />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg font-medium transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                    <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
                  </div>
                </button>

                <button
                  onClick={() => { setIsSidebarOpen(false); setShowSettings(true); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg font-medium transition-colors"
                >
                  <Settings size={18} /> Settings
                </button>

                <button
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg font-medium transition-colors"
                >
                  <LogOut size={18} /> Logout
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardPage;
