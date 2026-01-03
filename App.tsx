
import React, { useState, useEffect, useMemo, useRef } from 'react';
import TransactionForm from './components/TransactionForm';
import TransactionList from './components/TransactionList';
import CategoryBreakdown from './components/CategoryBreakdown';
import { processVoiceCommand } from './services/geminiService';
import { syncToSheets, fetchFromSheets } from './services/sheetsService';
import { Transaction, TransactionStatus, TransactionType, SheetConfig } from './types';
import { Wallet, TrendingUp, TrendingDown, Sparkles, RefreshCw, Settings, Info, AlertCircle, CheckCircle2, Moon, Sun, Mic, Square, Loader2, Key, Calendar, Target, PieChart, Clock, Plus, X, HelpCircle, Code, Copy, ExternalLink, ChevronRight, Trash2, Check, Layout, Edit2, Save, Menu } from 'lucide-react';
import { MONTHS_THAI } from './constants';

const App: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Sheet Management
  const [sheets, setSheets] = useState<SheetConfig[]>(() => {
    const saved = localStorage.getItem('wealth_sheets');
    if (saved) return JSON.parse(saved);
    const oldUrl = localStorage.getItem('wealth_sheet_url');
    if (oldUrl) {
      const oldBudget = Number(localStorage.getItem('wealth_budget')) || 0;
      return [{ id: 'default', name: 'รายรับ-รายจ่ายหลัก', url: oldUrl, budget: oldBudget }];
    }
    return [];
  });

  const [activeSheetId, setActiveSheetId] = useState<string>(() => {
    const savedId = localStorage.getItem('wealth_active_sheet_id');
    if (savedId) return savedId;
    if (localStorage.getItem('wealth_sheet_url')) return 'default';
    return '';
  });

  const activeSheet = sheets.find(s => s.id === activeSheetId);
  const sheetUrl = activeSheet?.url || '';

  const [geminiApiKey, setGeminiApiKey] = useState(localStorage.getItem('wealth_gemini_key') || '');

  const monthlyBudget = activeSheet?.budget || 0;

  const [showSettings, setShowSettings] = useState(!sheetUrl || !localStorage.getItem('wealth_gemini_key'));
  const [showGuide, setShowGuide] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(localStorage.getItem('theme') === 'dark');

  // New Sheet Form State
  const [newSheetName, setNewSheetName] = useState('');
  const [newSheetUrl, setNewSheetUrl] = useState('');
  const [newSheetBudget, setNewSheetBudget] = useState<string>('');

  // Edit Sheet State
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [editSheetName, setEditSheetName] = useState('');
  const [editSheetUrl, setEditSheetUrl] = useState('');
  const [editSheetBudget, setEditSheetBudget] = useState<string>('');

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Filter States
  const [filterMonth, setFilterMonth] = useState<number | 'all' | 'custom'>(new Date().getMonth());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterType, setFilterType] = useState<'all' | TransactionType>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | TransactionStatus>('all');
  const [filterCategory, setFilterCategory] = useState<string | 'all'>('all');

  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'listening' | 'processing'>('idle');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const skipSyncRef = useRef(true);

  // Persistence for Sheets
  useEffect(() => {
    localStorage.setItem('wealth_sheets', JSON.stringify(sheets));
  }, [sheets]);

  useEffect(() => {
    localStorage.setItem('wealth_active_sheet_id', activeSheetId);
  }, [activeSheetId]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    // Switch context when active sheet changes
    if (!activeSheetId) {
      if (sheets.length === 0) setTransactions([]);
      return;
    }

    setIsDataLoaded(false);

    // 1. Try to load from local cache for this specific sheet
    const localKey = `wealth_transactions_${activeSheetId}`;
    const saved = localStorage.getItem(localKey);

    if (saved) {
      skipSyncRef.current = true;
      setTransactions(JSON.parse(saved));
      setIsDataLoaded(true);
    } else if (activeSheetId === 'default' && !localStorage.getItem(localKey)) {
      // Migration fallback: check legacy key
      const legacySaved = localStorage.getItem('wealth_transactions');
      if (legacySaved) {
        skipSyncRef.current = true;
        setTransactions(JSON.parse(legacySaved));
        setIsDataLoaded(true);
        // Migrate to new key
        localStorage.setItem(localKey, legacySaved);
      }
    } else {
      // No local data for this sheet, clear transactions to avoid showing wrong data
      setTransactions([]);
    }

    // 2. Trigger pull if URL is available
    if (sheetUrl) {
      handlePull();
    }
  }, [activeSheetId, sheetUrl]); // Re-run when active sheet changes

  // Auto-push only depends on transactions changing, but we need to ensure we push to the correct sheet
  useEffect(() => {
    if (!sheetUrl) return;
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
      return;
    }
    const timer = setTimeout(() => handleAutoPush(), 2000);
    return () => clearTimeout(timer);
  }, [transactions, sheetUrl]);

  const handleAddSheet = () => {
    if (!newSheetName.trim() || !newSheetUrl.trim()) return;
    const newSheet: SheetConfig = {
      id: crypto.randomUUID(),
      name: newSheetName,
      url: newSheetUrl,
      budget: Number(newSheetBudget) || 0
    };
    setSheets(prev => [...prev, newSheet]);
    setNewSheetName('');
    setNewSheetUrl('');
    setNewSheetBudget('');
    // If it's the first sheet, auto-select it
    if (sheets.length === 0) {
      setActiveSheetId(newSheet.id);
    }
  };

  const handleRemoveSheet = (id: string) => {
    if (!confirm('คุณแน่ใจหรือไม่ที่จะลบชีทนี้?')) return;
    const newSheets = sheets.filter(s => s.id !== id);
    setSheets(newSheets);
    if (activeSheetId === id) {
      setActiveSheetId(newSheets.length > 0 ? newSheets[0].id : '');
    }
  };

  const handleStartEdit = (sheet: SheetConfig) => {
    setEditingSheetId(sheet.id);
    setEditSheetName(sheet.name);
    setEditSheetUrl(sheet.url);
    setEditSheetBudget(sheet.budget ? String(sheet.budget) : '');
  };

  const handleCancelEdit = () => {
    setEditingSheetId(null);
    setEditSheetName('');
    setEditSheetUrl('');
    setEditSheetBudget('');
  };

  const handleSaveSheet = () => {
    if (!editingSheetId || !editSheetName.trim() || !editSheetUrl.trim()) return;

    setSheets(prev => prev.map(s =>
      s.id === editingSheetId
        ? { ...s, name: editSheetName, url: editSheetUrl, budget: Number(editSheetBudget) || 0 }
        : s
    ));

    handleCancelEdit();
  };

  const handlePull = async () => {
    console.log("handlePull called. URL:", sheetUrl);
    if (!sheetUrl) {
      console.warn("No sheetUrl found, aborting pull.");
      return;
    }
    setIsLoading(true);
    try {
      const cloudData = await fetchFromSheets(sheetUrl);
      skipSyncRef.current = true;
      setTransactions(cloudData);
      // Save to sheet-specific storage
      localStorage.setItem(`wealth_transactions_${activeSheetId}`, JSON.stringify(cloudData));
      setIsDataLoaded(true);
    } catch (error) {
      console.error("Failed to pull data:", error);
      alert(`ไม่สามารถดึงข้อมูลได้: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoPush = async () => {
    if (!sheetUrl || isSyncing || isLoading || !isDataLoaded) return;
    setIsSyncing(true);
    const success = await syncToSheets(transactions, sheetUrl);
    // Save to sheet-specific storage
    if (success) localStorage.setItem(`wealth_transactions_${activeSheetId}`, JSON.stringify(transactions));
    setIsSyncing(false);
  };

  const handleAddTransaction = (t: Transaction) => {
    setTransactions(prev => [t, ...prev]);
    setIsAddModalOpen(false);
  };

  const handleUpdateTransaction = (t: Transaction) => {
    setTransactions(prev => prev.map(item => item.id === t.id ? t : item));
    setEditingTransaction(null);
  };

  const handleDeleteTransaction = (id: string) => setTransactions(prev => prev.filter(t => t.id !== id));

  const getLocalDateISOString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleUpdateStatus = (id: string, newStatus: TransactionStatus) => {
    const today = getLocalDateISOString();
    setTransactions(prev => prev.map(t =>
      t.id === id ? {
        ...t,
        status: newStatus,
        date: newStatus === 'paid' ? today : t.date
      } : t
    ));
  };

  const startRecording = async () => {
    console.log("Starting recording...");
    if (!geminiApiKey) {
      alert("กรุณาระบุ Gemini API Key ในส่วนการตั้งค่าก่อนใช้งานผู้ช่วยเสียง");
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
        console.log("Recorder stopped, processing audio...");
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        console.log("Audio blob size:", audioBlob.size);
        await processAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setVoiceStatus('listening');
      console.log("Recording started");
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("ไม่สามารถเข้าถึงไมโครโฟนได้ กรุณาอนุญาตการเข้าถึง");
    }
  };

  const stopRecording = () => {
    console.log("Stop recording clicked");
    if (mediaRecorderRef.current && voiceStatus === 'listening') {
      console.log("Stopping recorder manually");
      setVoiceStatus('processing');
      mediaRecorderRef.current.stop();
    }
  };

  const processAudio = async (blob: Blob) => {
    console.log("Processing audio function called");
    setVoiceStatus('processing');

    // Start timer to enforce minimum loading state
    const startTime = Date.now();

    try {
      console.log("Audio Blob size:", blob.size);
      if (blob.size === 0) {
        throw new Error("Audio blob is empty");
      }

      // 1. Convert to Base64
      console.log("Converting to base64...");
      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result.split(',')[1]);
          } else {
            reject(new Error('Failed to convert audio to base64'));
          }
        };
        reader.onerror = reject;
      });
      console.log("Base64 conversion complete");

      // 2. Send to Gemini
      console.log("Sending to Gemini...");
      const result = await processVoiceCommand(geminiApiKey, base64Audio, 'audio/webm')
        .catch(err => {
          console.error("Gemini API Error:", err);
          return null;
        });
      console.log("Gemini response received:", result);

      // 3. Enforce minimum loading time (2 seconds)
      const elapsed = Date.now() - startTime;
      const minDuration = 2000;
      if (elapsed < minDuration) {
        await new Promise(resolve => setTimeout(resolve, minDuration - elapsed));
      }

      if (result && result.amount) {
        const newTx: Transaction = {
          id: crypto.randomUUID(),
          type: (result.type as any) || 'expense',
          amount: result.amount,
          category: result.category || 'รายจ่ายอื่นๆ',
          date: result.date || getLocalDateISOString(),
          description: result.description || 'บันทึกด้วยเสียง',
          status: result.status || 'paid'
        };
        handleAddTransaction(newTx);
      } else {
        // Use a small timeout to allow the UI to update before alerting
        setTimeout(() => alert("ไม่เข้าใจข้อมูลที่คุณพูด ลองพูดว่า: 'จ่ายค่าอาหารกลางวันไปหกสิบบาท'"), 100);
      }
    } catch (error) {
      console.error("Error processing audio:", error);
      // Ensure we still waited if it failed super fast, to avoid flicker
      const elapsed = Date.now() - startTime;
      if (elapsed < 1000) {
        await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
      }
      setTimeout(() => alert("เกิดข้อผิดพลาดในการประมวลผลเสียง"), 100);
    } finally {
      console.log("Finished processing audio");
      setVoiceStatus('idle');
    }
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      let dateMatch = true;
      if (filterMonth === 'custom') {
        if (startDate && t.date < startDate) dateMatch = false;
        if (endDate && t.date > endDate) dateMatch = false;
      } else if (filterMonth !== 'all') {
        const parts = t.date.split('-');
        if (parts.length >= 2) {
          const tMonth = parseInt(parts[1], 10) - 1;
          dateMatch = tMonth === filterMonth;
        }
      }
      const typeMatch = filterType === 'all' || t.type === filterType;
      const statusMatch = filterStatus === 'all' || t.status === filterStatus;
      const categoryMatch = filterCategory === 'all' || t.category === filterCategory;
      return dateMatch && typeMatch && statusMatch && categoryMatch;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, filterMonth, startDate, endDate, filterType, filterStatus, filterCategory]);

  const monthFilteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (filterMonth === 'custom') {
        if (startDate && t.date < startDate) return false;
        if (endDate && t.date > endDate) return false;
        return true;
      }
      if (filterMonth === 'all') return true;
      const parts = t.date.split('-');
      if (parts.length >= 2) {
        return parseInt(parts[1], 10) - 1 === filterMonth;
      }
      return false;
    });
  }, [transactions, filterMonth, startDate, endDate]);

  const totals = useMemo(() => {
    return monthFilteredTransactions.reduce((acc, t) => {
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
    }, {
      income: 0,
      expense: 0,
      paidIncome: 0,
      paidExpense: 0,
      pendingIncome: 0,
      pendingExpense: 0
    });
  }, [monthFilteredTransactions]);

  const remainingBudget = monthlyBudget > 0 ? monthlyBudget - totals.expense : 0;
  const budgetProgress = monthlyBudget > 0 ? Math.min((totals.expense / monthlyBudget) * 100, 100) : 0;

  const appScriptCode = `// 1. READ DATA (doGet)
function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Server busy" })).setMimeType(ContentService.MimeType.JSON);
  }
  
  try {
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var headers = [];
    var result = [];
    if (lastRow > 0) {
      headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      if (lastRow > 1) {
        var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
        result = values.map(function(row) {
          var obj = {};
          headers.forEach(function(h, i) {
            obj[h] = row[i];
          });
          return obj;
        });
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({ error: e.toString() })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// 2. WRITE DATA (doPost)
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var incomingData = JSON.parse(e.postData.contents);
    
    // 1. Headers
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var existingHeaders = [];
    
    if (lastRow === 0) {
      existingHeaders = Object.keys(incomingData[0]);
      sheet.appendRow(existingHeaders);
      lastCol = existingHeaders.length;
    } else {
      existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    }
    // 2. Map Headers
    var headerMap = {};
    existingHeaders.forEach(function(h, i) { headerMap[h] = i; });
    // 3. Map Existing IDs
    var idMap = {};
    var idColIdx = headerMap['id'];
    var existingData = [];
    if (lastRow > 1) {
      existingData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
      if (idColIdx !== undefined) {
        existingData.forEach(function(row, i) {
          var id = String(row[idColIdx]);
          if (id) idMap[id] = i; 
        });
      }
    }
    // 4. Process Incoming Data
    var processedRowIndices = new Set(); 
    incomingData.forEach(function(item) {
      var itemId = String(item.id);
      
      var rowValues = existingHeaders.map(function(header) {
        return item[header] !== undefined ? item[header] : "";
      });
      if (itemId in idMap) {
        // UPDATE existing row
        var rowIndex = idMap[itemId];
        sheet.getRange(rowIndex + 2, 1, 1, rowValues.length).setValues([rowValues]);
        processedRowIndices.add(rowIndex);
      } else {
        // INSERT new row
        sheet.appendRow(rowValues);
      }
    });
    // 5. DELETE removed rows
    for (var i = existingData.length - 1; i >= 0; i--) {
      if (!processedRowIndices.has(i)) {
        sheet.deleteRow(i + 2);
      }
    }
    return ContentService.createTextOutput("Success");
  } catch (e) {
    return ContentService.createTextOutput("Error: " + e.toString());
  } finally {
    lock.releaseLock();
  }
}`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors pb-12 font-sans">
      <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 transition-colors">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg sm:hidden"
            >
              <Menu size={24} />
            </button>
            <div className="hidden sm:block p-2 bg-indigo-600 rounded-lg text-white">
              <Wallet size={20} />
            </div>
            <div className="flex flex-col sm:hidden">
              <span className="font-bold text-base text-slate-800 dark:text-slate-100 tracking-tight">
                คุณยายดวง 👵
              </span>
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="font-bold text-base text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1">
                คุณยายดวง 👵
                {activeSheet && (
                  <span className="ml-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 text-[10px] font-bold border border-indigo-100 dark:border-indigo-800">
                    {activeSheet.name}
                  </span>
                )}
              </span>
              <span className="text-[10px] text-indigo-500 font-medium -mt-1">ให้คุณยายช่วยจดจร้า</span>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-3">
            <div className="hidden sm:flex items-center gap-1 sm:gap-3">
              <button
                onClick={() => setShowGuide(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold text-slate-500 transition-colors"
              >
                <HelpCircle size={16} />
                <span className="hidden xs:inline">คู่มือ</span>
              </button>
              <button
                onClick={handlePull}
                disabled={isLoading || !sheetUrl}
                className={`p-2 rounded-xl transition-colors ${isLoading ? 'animate-spin text-indigo-500' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500'}`}
                title="ดึงข้อมูลล่าสุด"
              >
                <RefreshCw size={20} />
              </button>
              <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden xs:block"></div>
            </div>
            
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            
            <button onClick={() => setShowSettings(!showSettings)} className={`hidden sm:block p-2 rounded-xl transition-all ${showSettings ? 'bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              <Settings size={20} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Sidebar */}
      <div 
        className={`fixed inset-0 z-50 sm:hidden transition-all duration-300 ${
          isSidebarOpen ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        <div
          className={`absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 ${
            isSidebarOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setIsSidebarOpen(false)}
        />
        <div 
          className={`absolute left-0 top-0 bottom-0 w-[280px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-xl flex flex-col transition-transform duration-300 ease-out ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-600 rounded-lg text-white">
                <Wallet size={20} />
              </div>
              <span className="font-bold text-lg text-slate-800 dark:text-slate-100">เมนูหลัก</span>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-4 flex-1 overflow-y-auto">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">บัญชีของคุณ</h3>
                <button 
                  onClick={() => { setShowSettings(true); setIsSidebarOpen(false); }}
                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-md"
                >
                  จัดการ
                </button>
              </div>
              <div className="space-y-2">
                {sheets.map(sheet => (
                  <button
                    key={sheet.id}
                    onClick={() => {
                      setActiveSheetId(sheet.id);
                      setIsSidebarOpen(false);
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      activeSheetId === sheet.id
                        ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800 ring-1 ring-indigo-500/20 shadow-sm'
                        : 'bg-white border-slate-100 dark:bg-slate-800/50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-bold text-sm truncate ${activeSheetId === sheet.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>
                        {sheet.name}
                      </span>
                      {activeSheetId === sheet.id && <div className="w-2 h-2 rounded-full bg-indigo-500"></div>}
                    </div>
                    <div className="flex justify-between items-center">
                       <p className="text-[10px] text-slate-400 truncate font-mono max-w-[150px]">{sheet.url}</p>
                       <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        {sheet.budget ? `${sheet.budget.toLocaleString()} ฿` : '-'}
                       </p>
                    </div>
                  </button>
                ))}
                
                {sheets.length === 0 && (
                  <div className="p-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                    <p className="text-xs text-slate-400 mb-2">ยังไม่มีบัญชี</p>
                    <button
                      onClick={() => { setShowSettings(true); setIsSidebarOpen(false); }}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center justify-center gap-1"
                    >
                      <Plus size={14} /> เพิ่มบัญชี
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <button
                onClick={() => {
                  handlePull();
                  setIsSidebarOpen(false);
                }}
                disabled={isLoading || !sheetUrl}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                <span className="font-medium">ดึงข้อมูลล่าสุด</span>
              </button>

              <button
                onClick={() => {
                  setShowSettings(true);
                  setIsSidebarOpen(false);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
              >
                <Settings size={20} />
                <span className="font-medium">ตั้งค่า & จัดการบัญชี</span>
              </button>

              <button
                onClick={() => {
                  setShowGuide(true);
                  setIsSidebarOpen(false);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
              >
                <HelpCircle size={20} />
                <span className="font-medium">คู่มือการใช้งาน</span>
              </button>
            </div>
          </div>

          <div className="p-4 border-t border-slate-200 dark:border-slate-800">
            <p className="text-center text-xs text-slate-400">
              คุณยายดวง v1.0.0
              <br />
              ให้คุณยายช่วยจดจร้า
            </p>
          </div>
        </div>
      </div>

      {showSettings && (
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 animate-in slide-in-from-top duration-300">
          <div className="max-w-5xl mx-auto px-6 py-8">
            <div className="grid md:grid-cols-2 gap-12 items-start">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                    <Settings size={18} className="text-indigo-500" />
                    การตั้งค่าแอป
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    ข้อมูลของคุณจัดเก็บใน <span className="inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300"><img src="https://www.gstatic.com/images/branding/product/2x/sheets_2020q4_48dp.png" alt="Google Sheets" className="w-4 h-4" /> Google Sheet</span> ของคุณเท่านั้น มีความเป็นส่วนตัว 100% การจัดการข้อมูลดำเนินการผ่าน <span className="inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300"><img src="https://www.gstatic.com/images/branding/product/2x/apps_script_48dp.png" alt="Google Apps Script" className="w-4 h-4" /> Google Apps Script</span>
                  </p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
                      <Key size={12} /> Gemini AI API Key
                    </label>
                    <input
                      type="password"
                      placeholder="กรอก API Key ของคุณ..."
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      value={geminiApiKey}
                      onChange={(e) => { setGeminiApiKey(e.target.value); localStorage.setItem('wealth_gemini_key', e.target.value); }}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                        <Layout size={12} /> จัดการบัญชี (Google Sheets)
                      </label>
                    </div>

                    {/* Sheet List */}
                    <div className="space-y-2 mb-4">
                      {sheets.map(sheet => (
                        <div
                          key={sheet.id}
                          className={`flex flex-col gap-2 p-3 rounded-xl border transition-all ${activeSheetId === sheet.id
                            ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800'
                            : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700'
                            }`}
                        >
                          {editingSheetId === sheet.id ? (
                            <div className="space-y-2 w-full">
                              <input
                                type="text"
                                placeholder="ชื่อบัญชี"
                                className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                value={editSheetName}
                                onChange={(e) => setEditSheetName(e.target.value)}
                              />
                              <input
                                type="text"
                                placeholder="Google Appscript URL"
                                className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                                value={editSheetUrl}
                                onChange={(e) => setEditSheetUrl(e.target.value)}
                              />
                              <input
                                type="number"
                                placeholder="งบประมาณ (บาท)"
                                className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                value={editSheetBudget}
                                onChange={(e) => setEditSheetBudget(e.target.value)}
                              />
                              <div className="flex justify-end gap-2 mt-2">
                                <button
                                  onClick={handleCancelEdit}
                                  className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                                >
                                  <X size={16} />
                                </button>
                                <button
                                  onClick={handleSaveSheet}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700"
                                >
                                  <Save size={14} /> บันทึก
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between w-full">
                              <button
                                onClick={() => setActiveSheetId(sheet.id)}
                                className="flex-1 text-left flex items-center gap-3 min-w-0"
                              >
                                <div className={`flex-shrink-0 w-4 h-4 rounded-full border flex items-center justify-center ${activeSheetId === sheet.id
                                  ? 'border-indigo-600 bg-indigo-600 text-white'
                                  : 'border-slate-300 dark:border-slate-600'
                                  }`}>
                                  {activeSheetId === sheet.id && <Check size={10} />}
                                </div>
                                <div className="min-w-0">
                                  <p className={`text-sm font-bold truncate ${activeSheetId === sheet.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {sheet.name}
                                  </p>
                                  <div className="flex flex-col">
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                      งบ: {sheet.budget?.toLocaleString() || 0} ฿
                                    </p>
                                    <p className="text-[10px] text-slate-400 truncate max-w-[180px] font-mono opacity-70">{sheet.url}</p>
                                  </div>
                                </div>
                              </button>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() => handleStartEdit(sheet)}
                                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => handleRemoveSheet(sheet.id)}
                                  className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Add New Sheet */}
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                      <p className="text-xs font-bold text-slate-500">เพิ่มบัญชีใหม่</p>
                      <input
                        type="text"
                        placeholder="ชื่อบัญชี (เช่น ท่องเที่ยว, เงินออม)"
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        value={newSheetName}
                        onChange={(e) => setNewSheetName(e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="Web App URL..."
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        value={newSheetUrl}
                        onChange={(e) => setNewSheetUrl(e.target.value)}
                      />
                      <input
                        type="number"
                        placeholder="งบประมาณ (บาท)"
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        value={newSheetBudget}
                        onChange={(e) => setNewSheetBudget(e.target.value)}
                      />
                      <button
                        onClick={handleAddSheet}
                        disabled={!newSheetName || !newSheetUrl}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-all"
                      >
                        เพิ่มบัญชี
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-700">
               
                <button
                  onClick={() => setShowSettings(false)}
                  disabled={!sheetUrl}
                  className="w-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold py-4 rounded-xl disabled:opacity-30 transition-all mt-4"
                >
                  บันทึกและเริ่มใช้งาน
                </button>

                 <div className="flex gap-4 mb-2 mt-2">
                  <div className="p-3 bg-indigo-100 dark:bg-indigo-900/40 rounded-2xl text-indigo-600">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                      <path d="M12.0002 4.10376C13.5658 8.01633 15.9839 10.4344 19.8965 12.0002C15.9839 13.5659 13.5658 15.9839 12.0002 19.8965C10.4346 15.9839 8.01653 13.5659 4.10376 12.0002C8.01653 10.4344 10.4346 8.01633 12.0002 4.10376Z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold">ต้องการ ผู้ช่วย AI ?</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">เพื่อใช้งานการจดคำสั่งด้วย AI voice กรุณากรอก Gemini API Key</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Setup Guide Modal */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowGuide(false)} />
          <div className="relative w-full max-w-3xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 rounded-xl text-white">
                  <HelpCircle size={20} />
                </div>
                <h3 className="text-xl font-bold">คู่มือการตั้งค่า Google Sheets</h3>
              </div>
              <button onClick={() => setShowGuide(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="p-8 overflow-y-auto max-h-[calc(90vh-100px)] custom-scrollbar">
              <div className="space-y-10 pb-10">
                {/* Step 1 */}
                <section className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-sm text-indigo-600">1</span>
                    <h4 className="font-bold text-lg">สร้าง Google Sheet ใหม่</h4>
                  </div>
                  <div className="pl-11">
                    <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-4">
                      ไปที่ <a href="https://sheets.new" target="_blank" className="text-indigo-600 font-bold hover:underline inline-flex items-center gap-1">sheets.new <ExternalLink size={12} /></a> และตั้งชื่อไฟล์ตามต้องการ
                    </p>
                  </div>
                </section>

                {/* Step 2 */}
                <section className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-sm text-indigo-600">2</span>
                    <h4 className="font-bold text-lg">เปิด Apps Script Editor</h4>
                  </div>
                  <div className="pl-11">
                    <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-4">
                      คลิกที่เมนู <b>ส่วนขยาย (Extensions)</b> <b>Apps Script</b>
                    </p>
                  </div>
                </section>

                {/* Step 3 */}
                <section className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-sm text-indigo-600">3</span>
                    <h4 className="font-bold text-lg">วางโค้ดสคริปต์</h4>
                  </div>
                  <div className="pl-11 space-y-4">
                    <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                      คัดลอกโค้ดด้านล่างนี้ไปวางแทนที่โค้ดเดิมทั้งหมดในไฟล์ <code className="text-indigo-500 font-bold">Code.gs</code>
                    </p>
                    <div className="relative group">
                      <pre className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl text-[11px] overflow-x-auto border border-slate-200 dark:border-slate-800 font-mono text-slate-700 dark:text-slate-300">
                        {appScriptCode}
                      </pre>
                      <button
                        onClick={() => { navigator.clipboard.writeText(appScriptCode); alert("คัดลอกโค้ดแล้ว!"); }}
                        className="absolute top-2 right-2 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Copy size={14} className="text-slate-500" />
                      </button>
                    </div>
                  </div>
                </section>

                {/* Step 4 */}
                <section className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-sm text-indigo-600">4</span>
                    <h4 className="font-bold text-lg">ปรับใช้ (Deploy)</h4>
                  </div>
                  <div className="pl-11 space-y-4">
                    <ul className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed space-y-2 list-disc ml-4">
                      <li>คลิกปุ่ม <b>การใช้งานได้จริง (Deploy)</b>  <b>การปรับใช้ใหม่ (New deployment)</b></li>
                      <li>เลือกประเภทเป็น <b>เว็บแอป (Web app)</b></li>
                      <li>เลือก "เรียกใช้ในฐานะ" เป็น <b>ฉัน (Me)</b></li>
                      <li>เลือก "ผู้ที่มีสิทธิ์เข้าถึง" เป็น <b>ทุกคน (Anyone)</b></li>
                      <li>คลิก <b>ปรับใช้ (Deploy)</b> และให้สิทธิ์การเข้าถึง (Authorize access)</li>
                    </ul>
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-[12px] text-amber-700 dark:text-amber-400 leading-relaxed font-medium">
                      <AlertCircle size={14} className="inline mr-2 mb-1" />
                      <b>ข้อควรระวัง:</b> โปรดตรวจสอบว่าเลือก "ผู้ที่มีสิทธิ์เข้าถึง" เป็น "ทุกคน" (Anyone) เพื่อให้แอปสามารถส่งข้อมูลได้
                    </div>
                  </div>
                </section>

                {/* Step 5 */}
                <section className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-sm text-indigo-600">5</span>
                    <h4 className="font-bold text-lg">คัดลอก URL มาวางในแอป</h4>
                  </div>
                  <div className="pl-11">
                    <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-4">
                      คัดลอก <b>   placeholder="Google Appscript URL"</b> (จะขึ้นต้นด้วย <code className="text-indigo-500">https://script.google.com/...</code>) นำมาวางในส่วนการตั้งค่าของแอปนี้
                    </p>
                    <button
                      onClick={() => { setShowGuide(false); setShowSettings(true); }}
                      className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all"
                    >
                      ไปที่หน้าตั้งค่า <ChevronRight size={16} />
                    </button>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-indigo-600 dark:bg-indigo-700 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden transition-all group">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <div className="space-y-0.5">
                  <p className="text-indigo-100/70 text-[10px] font-bold uppercase tracking-widest">ยอดคงเหลือสุทธิ</p>
                  <p className="text-white text-xs font-semibold">
                    {filterMonth === 'all' ? 'ทั้งหมด' : filterMonth === 'custom' ? 'กำหนดเอง' : `เดือน ${MONTHS_THAI[filterMonth as number]}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 backdrop-blur-md">
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
                    <option value="all" className="text-slate-900">ทั้งหมด</option>
                    <option value="custom" className="text-slate-900">กำหนดเอง</option>
                    {MONTHS_THAI.map((m, i) => (
                      <option key={m} value={i} className="text-slate-900">{m}</option>
                    ))}
                  </select>
                </div>
              </div>
              <h2 className="text-4xl font-bold mb-4 tracking-tight">
                <span className="text-2xl font-normal mr-1 opacity-80">฿</span>
                {(totals.income - totals.expense).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h2>

              {monthlyBudget > 0 && filterMonth !== 'all' && (
                <div className="mb-6 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-tighter text-indigo-100">
                    <span>งบประมาณคงเหลือ</span>
                    <span>{remainingBudget.toLocaleString()} / {monthlyBudget.toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-indigo-900/40 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-1000 ${budgetProgress > 90 ? 'bg-rose-400' : budgetProgress > 70 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                      style={{ width: `${budgetProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 group-hover:bg-white/15 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-400/20 rounded-lg text-emerald-300">
                      <TrendingUp size={18} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">รายรับรวม</span>
                      {totals.pendingIncome > 0 && (
                        <span className="text-[9px] text-emerald-200/60 leading-none flex items-center gap-1">
                          <Clock size={8} /> ค้างรับ: {totals.pendingIncome.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="font-bold text-lg">฿{totals.income.toLocaleString()}</p>
                </div>

                <div className="flex items-center justify-between bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 group-hover:bg-white/15 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-400/20 rounded-lg text-rose-300">
                      <TrendingDown size={18} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-100">รายจ่ายรวม</span>
                      {totals.pendingExpense > 0 && (
                        <span className="text-[9px] text-rose-200/60 leading-none flex items-center gap-1">
                          <Clock size={8} /> ค้างจ่าย: {totals.pendingExpense.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="font-bold text-lg">฿{totals.expense.toLocaleString()}</p>
                </div>
              </div>

              <div className="mt-8">
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="w-full flex items-center justify-center gap-3 py-4 bg-white text-indigo-600 font-bold rounded-2xl shadow-xl hover:bg-indigo-50 active:scale-95 transition-all"
                >
                  <Plus size={20} /> เพิ่มรายการใหม่
                </button>
              </div>
            </div>
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
            <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 bg-indigo-400/10 rounded-full blur-xl"></div>
          </div>

          <CategoryBreakdown transactions={monthFilteredTransactions} />
        </div>

        <div className="lg:col-span-2 space-y-6">
          {geminiApiKey && (
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 dark:from-indigo-800 dark:to-purple-900 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden transition-all">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm"><Mic size={24} /></div>
                    <div>
                      <h3 className="text-xl font-bold">ผู้ช่วยเสียงอัจฉริยะ</h3>
                      <p className="text-indigo-100/80 text-xs">บันทึกรายการด้วยเสียง (ภาษาไทย)</p>
                    </div>
                  </div>
                  {voiceStatus === 'processing' && <Loader2 size={24} className="animate-spin text-white/50" />}
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/10 mb-6 text-center shadow-inner">
                  {voiceStatus === 'listening' ? (
                    <div className="space-y-4 py-2">
                      <div className="flex justify-center gap-1.5 h-10 items-center">
                        {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="w-1.5 bg-white rounded-full animate-bounce" style={{ height: `${20 + Math.random() * 80}%`, animationDelay: `${i * 0.08}s` }}></div>)}
                      </div>
                      <p className="text-sm font-medium animate-pulse">กำลังฟังเสียงของคุณ...</p>
                      <button onClick={stopRecording} className="mx-auto flex items-center gap-2 px-8 py-3 bg-rose-500 hover:bg-rose-600 rounded-2xl font-bold shadow-lg active:scale-95 transition-all"><Square size={18} /> หยุดและบันทึก</button>
                    </div>
                  ) : voiceStatus === 'processing' ? (
                    <div className="space-y-4 py-4">
                      <div className="flex justify-center items-center h-12">
                        <Loader2 size={40} className="text-indigo-200 animate-spin" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">กำลังคุยกับ Gemini...</p>
                        <p className="text-xs text-indigo-200/60">ระบบกำลังวิเคราะห์ข้อมูลรายรับ-รายจ่ายของคุณ</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 py-2">
                      <p className="text-sm text-indigo-50 italic opacity-80 leading-relaxed">
                        "กินก๋วยเตี๋ยวไปห้าสิบบาท" <br />
                        "ได้รับเงินเดือนสามหมื่นบาท"
                      </p>
                      <button
                        onClick={startRecording}
                        disabled={voiceStatus === 'processing'}
                        className="mx-auto flex items-center gap-3 px-10 py-4 bg-white text-indigo-600 hover:bg-indigo-50 rounded-2xl font-bold shadow-lg disabled:opacity-50 active:scale-95 transition-all"
                      >
                        <Mic size={22} /> กดเพื่อพูด
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-indigo-200/60"><Sparkles size={12} /> ขับเคลื่อนด้วย Gemini Flash</div>
              </div>
              <div className="absolute -right-16 -bottom-16 text-white/5 rotate-45">
                <Mic size={280} />
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
          />
        </div>
      </main>

      <footer className="py-8 text-center pb-12">
        <div className="flex items-center justify-center gap-2 mb-2 opacity-60">
          <div className="p-1.5 bg-indigo-600 rounded-lg text-white">
            <Wallet size={12} />
          </div>
          <span className="font-bold text-sm text-slate-400 dark:text-slate-500">App คุณยายดวง</span>
        </div>
        <p className="text-[10px] text-slate-400/60 dark:text-slate-600 font-medium">
          ช่วยคุณยายจดบันทึกรายรับ-รายจ่ายง่ายๆ
        </p>
      </footer>

      {/* Transaction Modal (Add/Edit) */}
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
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
