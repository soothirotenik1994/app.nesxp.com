import React, { useState, useEffect } from 'react';
import { Smartphone, Download, Info, X, Share } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';

export const PWAInstallButton: React.FC = () => {
  const { t } = useTranslation();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }

    // Platform detection
    const ua = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform('ios');
    } else if (/android/.test(ua)) {
      setPlatform('android');
    }

    // Listen for install prompt (Android/Desktop)
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (platform === 'ios') {
      setShowIOSModal(true);
    } else if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      // Fallback for Android if prompt event didn't fire yet or already fired
      alert(t('pwa_install_android_tip', 'กรุณากดที่เมนู 3 จุดของเบราว์เซอร์ แล้วเลือก "ติดตั้งแอป" (Install App)'));
    }
  };

  if (isInstalled) return null;

  return (
    <>
      <button
        onClick={handleInstallClick}
        className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold transition-all shadow-lg shadow-slate-900/10 active:scale-[0.98] group"
      >
        <Smartphone className="w-5 h-5 group-hover:scale-110 transition-transform" />
        <span>{t('install_pwa_btn', 'ติดตั้ง Fleet Mobile App')}</span>
        <Download className="w-4 h-4 opacity-50 ml-1" />
      </button>

      {/* iOS Instruction Modal */}
      <AnimatePresence>
        {showIOSModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl"
            >
              <div className="p-6 bg-primary text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-6 h-6" />
                  <h3 className="font-bold">{t('install_on_ios', 'วิธีติดตั้งบน iPhone')}</h3>
                </div>
                <button onClick={() => setShowIOSModal(false)} className="p-1 hover:bg-white/10 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-8 space-y-8">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
                    <span className="font-bold text-primary">1</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 mb-1">{t('ios_step_1_title', 'กดปุ่มแชร์ (Share)')}</p>
                    <p className="text-xs text-slate-500 leading-relaxed">{t('ios_step_1_desc', 'มองหาไอคอนสี่เหลี่ยมที่มีลูกศรชี้ขึ้น ที่แถบด้านล่างของ Safari')}</p>
                    <div className="mt-3 flex justify-center">
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <Share className="w-8 h-8 text-blue-500" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
                    <span className="font-bold text-primary">2</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 mb-1">{t('ios_step_2_title', 'เลือก "เพิ่มลงในหน้าจอโฮม"')}</p>
                    <p className="text-xs text-slate-500 leading-relaxed">{t('ios_step_2_desc', 'เลื่อนหาเมนู "Add to Home Screen" เพื่อติดตั้งแอปลงบนมือถือ')}</p>
                    <div className="mt-3 flex justify-center">
                      <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="w-6 h-6 bg-slate-200 rounded-md"></div>
                        <span className="text-[10px] font-bold text-slate-600">Add to Home Screen</span>
                      </div>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setShowIOSModal(false)}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold"
                >
                  {t('got_it', 'รับทราบ')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
