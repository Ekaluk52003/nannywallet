
import React, { useState, useEffect, useMemo, useRef } from 'react';
import TransactionForm from './components/TransactionForm';
import TransactionList from './components/TransactionList';
import CategoryBreakdown from './components/CategoryBreakdown';
import { processVoiceCommand } from './services/geminiService';
import { syncToSheets, fetchFromSheets } from './services/sheetsService';
import { Transaction, TransactionStatus, TransactionType } from './types';
import { Wallet, TrendingUp, TrendingDown, Sparkles, RefreshCw, Settings, Info, AlertCircle, CheckCircle2, Moon, Sun, Mic, Square, Loader2, Key, Calendar, Target, PieChart, Clock, Plus, X, HelpCircle, Code, Copy, ExternalLink, ChevronRight } from 'lucide-react';
import { MONTHS_THAI } from './constants';

const App: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  
  const [sheetUrl, setSheetUrl] = useState(localStorage.getItem('wealth_sheet_url') || '');
  const [geminiApiKey, setGeminiApiKey] = useState(localStorage.getItem('wealth_gemini_key') || '');
  const [monthlyBudget, setMonthlyBudget] = useState(Number(localStorage.getItem('wealth_budget')) || 0);
  
  const [showSettings, setShowSettings] = useState(!localStorage.getItem('wealth_sheet_url') || !localStorage.getItem('wealth_gemini_key'));
  const [showGuide, setShowGuide] = useState(false);
  const [darkMode, setDarkMode] = useState(localStorage.getItem('theme') === 'dark');

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
    if (sheetUrl) {
      setIsDataLoaded(false);
      handlePull();
    } else {
      const saved = localStorage.getItem('wealth_transactions');
      if (saved) {
        skipSyncRef.current = true;
        setTransactions(JSON.parse(saved));
      }
    }
  }, [sheetUrl]);

  useEffect(() => {
    if (!sheetUrl) return;
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
      return;
    }
    const timer = setTimeout(() => handleAutoPush(), 2000);
    return () => clearTimeout(timer);
  }, [transactions, sheetUrl]);

  const handlePull = async () => {
    if (!sheetUrl) return;
    setIsLoading(true);
    const cloudData = await fetchFromSheets(sheetUrl);
    if (cloudData !== null) {
      skipSyncRef.current = true;
      setTransactions(cloudData);
      localStorage.setItem('wealth_transactions', JSON.stringify(cloudData));
      setIsDataLoaded(true);
    }
    setIsLoading(false);
  };

  const handleAutoPush = async () => {
    if (!sheetUrl || isSyncing || isLoading || !isDataLoaded) return;
    setIsSyncing(true);
    const success = await syncToSheets(transactions, sheetUrl);
    if (success) localStorage.setItem('wealth_transactions', JSON.stringify(transactions));
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

  const appScriptCode = `function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var result = [];
  var headers = data[0];
  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    result.push(obj);
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  sheet.clear();
  if (data.length > 0) {
    var headers = Object.keys(data[0]);
    sheet.appendRow(headers);
    data.forEach(function(row) {
      var values = headers.map(function(h) { return row[h]; });
      sheet.appendRow(values);
    });
  }
  return ContentService.createTextOutput("Success");
}`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors pb-12 font-sans">
      <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 transition-colors">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600 rounded-lg text-white">
              <Wallet size={20} />
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="font-bold text-base text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1">
                คุณยายดวง 👵
              </span>
              <span className="text-[10px] text-indigo-500 font-medium -mt-1">ให้คุณยายช่วยจดจร้า</span>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-3">
            <button 
              onClick={() => setShowGuide(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold text-slate-500 transition-colors"
            >
              <HelpCircle size={16} /> 
              <span className="hidden xs:inline">คู่มือ</span>
            </button>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden xs:block"></div>
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded-xl transition-all ${showSettings ? 'bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              <Settings size={20} />
            </button>
          </div>
        </div>
      </nav>

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
                    ข้อมูลของคุณจะถูกเก็บไว้ในเบราว์เซอร์นี้และ Google Sheet ของคุณเท่านั้น มีความเป็นส่วนตัว 100%
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
                    <label className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
                      <RefreshCw size={12} /> Google Sheets Web App URL
                    </label>
                    <input
                      type="text"
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      value={sheetUrl}
                      onChange={(e) => { setSheetUrl(e.target.value); localStorage.setItem('wealth_sheet_url', e.target.value); }}
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
                      <Target size={12} /> งบประมาณรายเดือน (บาท)
                    </label>
                    <input
                      type="number"
                      placeholder="เช่น 15000"
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      value={monthlyBudget || ''}
                      onChange={(e) => { setMonthlyBudget(Number(e.target.value)); localStorage.setItem('wealth_budget', e.target.value); }}
                    />
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-700">
                <div className="flex gap-4 mb-4">
                  <div className="p-3 bg-indigo-100 dark:bg-indigo-900/40 rounded-2xl text-indigo-600">
                    <Info size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold">ทำไมต้องระบุ Key เอง?</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">เพื่อให้คุณเป็นเจ้าของข้อมูลทั้งหมด และใช้งานโควตาฟรีส่วนตัวของคุณได้โดยตรง ไม่ต้องผ่านเซิร์ฟเวอร์กลาง</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowSettings(false)} 
                  disabled={!sheetUrl || !geminiApiKey}
                  className="w-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold py-4 rounded-xl disabled:opacity-30 transition-all"
                >
                  บันทึกและเริ่มใช้งาน
                </button>
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
                      ไปที่ <a href="https://sheets.new" target="_blank" className="text-indigo-600 font-bold hover:underline inline-flex items-center gap-1">sheets.new <ExternalLink size={12}/></a> และตั้งชื่อไฟล์ตามต้องการ
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
                      คัดลอก <b>Web App URL</b> (จะขึ้นต้นด้วย <code className="text-indigo-500">https://script.google.com/...</code>) นำมาวางในส่วนการตั้งค่าของแอปนี้
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
                      {[1,2,3,4,5,6].map(i => <div key={i} className="w-1.5 bg-white rounded-full animate-bounce" style={{ height: `${20 + Math.random()*80}%`, animationDelay: `${i*0.08}s` }}></div>)}
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
                      "กินก๋วยเตี๋ยวไปห้าสิบบาท" <br/> 
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
