import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Wallet, Sparkles } from 'lucide-react';
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-8 text-center space-y-8 animate-in zoom-in-95 duration-300">
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-600/30">
            <Wallet size={48} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Nanywallet</h1>
            <p className="text-slate-500 dark:text-slate-400">ผู้ช่วยจดรายรับ-รายจ่าย อัจฉริยะ</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl text-left space-y-3">
            <div className="flex items-center gap-3 text-indigo-700 dark:text-indigo-300 font-bold">
              <Sparkles size={20} />
              <span>ฟีเจอร์เด่น</span>
            </div>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2 list-disc pl-5">
              <li>จดบันทึกด้วยเสียงผ่าน Gemini AI</li>
              <li>สร้าง Google Sheet ให้อัตโนมัติ</li>
              <li>ข้อมูลปลอดภัย อยู่ใน Google Drive ของคุณ</li>
            </ul>
          </div>

          <button
            onClick={() => login()}
            disabled={isLoading}
            className="w-full py-4 px-6 bg-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-3 transition-all shadow-sm hover:shadow-md active:scale-95 disabled:opacity-70"
          >
            {isLoading ? (
              <span>กำลังโหลด...</span>
            ) : (
              <>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
                <span>เข้าสู่ระบบด้วย Google</span>
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-slate-400">
          โดยการเข้าสู่ระบบ คุณยอมรับเงื่อนไขการใช้งาน <br />
          และอนุญาตให้แอปจัดการไฟล์ Google Sheets ของคุณ
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
