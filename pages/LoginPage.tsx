import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Wallet, Sparkles, Mic, TrendingUp, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LoginPage: React.FC = () => {
  const { login, isLoading, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex transition-colors font-sans">
      {/* Left Side - Content Teaser (Hidden on mobile, visible on lg) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-indigo-600 dark:bg-indigo-950 overflow-hidden text-white p-12 flex-col justify-between">
        {/* Background Decoration */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
          <div className="absolute -top-[20%] -left-[10%] w-[70vh] h-[70vh] rounded-full bg-purple-500/30 blur-[100px]" />
          <div className="absolute top-[40%] -right-[10%] w-[60vh] h-[60vh] rounded-full bg-blue-500/30 blur-[100px]" />
        </div>

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-8 opacity-80">
            <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
              <Wallet className="text-white" size={20} />
            </div>
            <span className="font-bold text-lg tracking-tight">Nanywallet</span>
          </div>

          <h1 className="text-5xl font-extrabold leading-tight mb-6">
            Your AI-Powered <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-200 to-indigo-100">
              Financial Assistant
            </span>
          </h1>
          <p className="text-indigo-100 text-lg max-w-md leading-relaxed opacity-90">
            Experience the future of personal finance tracking. Just speak naturally, and let Gemini AI handle the accounting.
          </p>
        </div>

        {/* Mock UI Elements */}
        <div className="relative z-10 w-full max-w-md mx-auto mt-12 transform hover:scale-[1.02] transition-transform duration-500">
          {/* Glass Card 1: Voice Input */}
          <div className="absolute -right-12 -top-16 z-20 bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-2xl shadow-2xl animate-in slide-in-from-right duration-700 fade-in fill-mode-both delay-100 w-64">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-rose-500 rounded-lg text-white shadow-lg shadow-rose-500/30">
                <Mic size={16} />
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="h-1.5 w-16 bg-white/50 rounded-full animate-pulse" />
                <div className="h-1.5 w-full bg-white/30 rounded-full" />
              </div>
            </div>
            <p className="text-sm font-medium text-white">"Lunch cost 150 baht"</p>
            <div className="mt-2 flex items-center gap-2 text-[10px] text-white/60">
              <Sparkles size={10} />
              <span>Processing with Gemini...</span>
            </div>
          </div>

          {/* Main Card: Dashboard Summary */}
          <div className="bg-white/95 backdrop-blur-sm rounded-[2.5rem] p-8 text-slate-900 shadow-2xl border border-white/50 animate-in slide-in-from-bottom duration-700 fade-in fill-mode-both">
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Balance</p>
                <h3 className="text-4xl font-black text-slate-800 tracking-tight">฿42,500<span className="text-slate-300">.00</span></h3>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <TrendingUp size={24} />
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-1.5 h-10 bg-emerald-400 rounded-full" />
                  <div>
                    <p className="font-bold text-sm text-slate-700">Income</p>
                    <p className="text-xs text-slate-400 font-medium">Salary, Freelance</p>
                  </div>
                </div>
                <span className="font-bold text-emerald-600">+฿50,000</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-1.5 h-10 bg-rose-400 rounded-full" />
                  <div>
                    <p className="font-bold text-sm text-slate-700">Expense</p>
                    <p className="text-xs text-slate-400 font-medium">Food, Travel, Bills</p>
                  </div>
                </div>
                <span className="font-bold text-rose-600">-฿7,500</span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-indigo-200 opacity-60 font-medium tracking-wide">
          © 2026 Nanywallet. Secure by Google Drive.
        </div>
      </div>

      {/* Right Side - Login */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 relative">
        <div className="w-full max-w-sm space-y-10">
          <div className="text-center lg:text-left space-y-3">
            <div className="inline-block lg:hidden p-4 bg-indigo-600 rounded-2xl text-white mb-6 shadow-xl shadow-indigo-600/30">
              <Wallet size={32} />
            </div>
            <h2 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">Welcome Back</h2>
            <p className="text-slate-500 dark:text-slate-400 text-lg">Connect your wallet to get started.</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => login()}
              disabled={isLoading}
              className="group w-full py-4 px-6 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 hover:border-indigo-600 dark:hover:border-indigo-500 text-slate-700 dark:text-white rounded-2xl font-bold flex items-center justify-center gap-3 transition-all hover:shadow-xl hover:-translate-y-1 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-indigo-50 dark:bg-indigo-900/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              <div className="relative flex items-center gap-3">
                {isLoading ? (
                  <span className="animate-pulse">Connecting...</span>
                ) : (
                  <>
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6 group-hover:scale-110 transition-transform duration-300" />
                    <span>Continue with Google</span>
                  </>
                )}
              </div>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 pt-8 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800/80 transition-colors shadow-sm">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 rounded-xl">
                <Sparkles size={20} />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">AI Powered</h4>
                <p className="text-xs text-slate-500 mt-0.5">Smart categorization with Gemini</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800/80 transition-colors shadow-sm">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 rounded-xl">
                <Shield size={20} />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">Private & Secure</h4>
                <p className="text-xs text-slate-500 mt-0.5">Your data stays in your Google Drive</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
