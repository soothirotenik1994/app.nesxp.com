import React, { useState } from 'react';
import { Sparkles, X, Loader2, MessageSquare, TrendingUp, AlertCircle, CheckCircle2, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { useTranslation } from 'react-i18next';

interface AiAssistantProps {
  data: {
    cars: any[];
    carStatuses: any[];
    recentJobs: any[];
    jobStats: any[];
  };
}

export const AiAssistant: React.FC<AiAssistantProps> = ({ data }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);

  const generateInsight = async () => {
    setLoading(true);
    setIsOpen(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const prompt = `
        You are a Logistics Expert AI for "Nationwide Express Tracking". 
        Analyze the following fleet data and provide a concise, high-level summary (in Thai) including:
        1. Current fleet health (Online vs Offline).
        2. Performance summary based on recent jobs.
        3. Strategic suggestions for optimization.

        Fleet Data:
        - Total Vehicles: ${data.cars.length}
        - Vehicles Online: ${data.carStatuses.filter(s => s.status === 'online').length}
        - Vehicles Offline: ${data.carStatuses.filter(s => s.status === 'offline').length}
        - Recent Jobs Summary: ${JSON.stringify(data.jobStats)}
        
        Keep it professional, helpful, and use Bullet points.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setInsight(response.text || "ขออภัย ไม่สามารถดึงข้อมูลได้ในขณะนี้");
    } catch (error) {
      console.error("AI Insight Error:", error);
      setInsight("เกิดข้อผิดพลาดในการเชื่อมต่อกับ AI กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={generateInsight}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all hover:scale-105 active:scale-95 group"
      >
        <Sparkles className="w-5 h-5 animate-pulse group-hover:rotate-12 transition-transform" />
        <span>{t('ai_insights', 'AI Insights')}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]"
            >
              {/* Header */}
              <div className="p-6 bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-900 text-white flex items-center justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
                <div className="flex items-center gap-3 relative z-10">
                  <div className="p-2 bg-indigo-500/20 rounded-lg">
                    <Sparkles className="w-6 h-6 text-indigo-300" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold tracking-tight">AI Fleet Assistant</h3>
                    <p className="text-xs text-indigo-300 font-medium">{t('intelligent_monitoring', 'การเฝ้าระวังอัจฉริยะ')}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors relative z-10"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <div className="relative">
                      <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                      <Sparkles className="w-6 h-6 text-purple-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <p className="text-slate-500 font-medium animate-pulse">{t('analyzing_fleet_data', 'กำลังวิเคราะห์ข้อมูลกองรถ...')}</p>
                  </div>
                ) : (
                  <div className="prose prose-slate max-w-none">
                    <div className="flex items-start gap-3 mb-4 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                      <TrendingUp className="w-5 h-5 text-indigo-600 mt-1" />
                      <div>
                        <h4 className="text-sm font-bold text-indigo-900 m-0">{t('summary_insights', 'สรุปผลวิเคราะห์อัจฉริยะ')}</h4>
                        <div className="text-sm text-slate-700 leading-relaxed mt-2 whitespace-pre-line">
                          {insight}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">{t('active', 'ปกติ')}</span>
                        </div>
                        <div className="text-2xl font-black text-emerald-900">
                          {data.carStatuses.filter(s => s.status === 'online').length}
                        </div>
                        <div className="text-[10px] font-bold text-emerald-600/70">{t('vehicles_ready', 'รถพร้อมใช้งาน')}</div>
                      </div>
                      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertCircle className="w-4 h-4 text-amber-600" />
                          <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">{t('offline', 'ออฟไลน์')}</span>
                        </div>
                        <div className="text-2xl font-black text-amber-900">
                          {data.carStatuses.filter(s => s.status === 'offline').length}
                        </div>
                        <div className="text-[10px] font-bold text-amber-600/70">{t('no_signal', 'ไม่มีสัญญาณ')}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <Activity className="w-3 h-3" />
                  Powered by Gemini 3.0
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-6 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors"
                >
                  {t('close', 'ปิด')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
