import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { MessageSquare, Save, AlertCircle, Send, Loader2, CheckCircle2, XCircle, User } from 'lucide-react';
import { lineService } from '../services/lineService';
import { directusApi } from '../api/directus';

export const LineSettings: React.FC = () => {
  const { t } = useTranslation();
  const [isEnabled, setIsEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [testLineId, setTestLineId] = useState('');
  const [driverLineId, setDriverLineId] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    const savedSetting = localStorage.getItem('line_notifications_enabled');
    if (savedSetting !== null) {
      setIsEnabled(savedSetting === 'true');
    }

    // Fetch a sample driver's LINE ID
    const fetchDriverLineId = async () => {
      try {
        const members = await directusApi.getMembers();
        const driver = members.find(m => m.role === 'driver' && m.line_user_id);
        if (driver) {
          setDriverLineId(driver.line_user_id);
        }
      } catch (error) {
        console.error('Failed to fetch driver LINE ID:', error);
      }
    };
    fetchDriverLineId();
  }, []);

  const handleSave = () => {
    setIsSaving(true);
    localStorage.setItem('line_notifications_enabled', isEnabled.toString());
    
    setTimeout(() => {
      setIsSaving(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }, 500);
  };

  const handleTestLine = async () => {
    if (!testLineId) return;
    setIsTesting(true);
    setTestStatus(null);
    try {
      const messages = [
        {
          type: "text",
          text: "🔔 มีงานใหม่มอบหมายให้คุณ\n\n🏢 ลูกค้า: เนชั่นไวด์ เอ็กซ์เพรส เซอร์วิส จำกัด\n📍 ต้นทาง: กรุงเทพฯ\n🏁 ปลายทาง: เชียงใหม่\n🚚 รถ: ผบ-4104\n📅 วันที่: 2026-03-14"
        },
        {
          type: "flex",
          altText: "มีงานใหม่มอบหมายให้คุณ",
          contents: {
            type: "bubble",
            header: {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "text",
                  text: "Nationwide Express Tracker",
                  color: "#ffffff",
                  weight: "bold",
                  size: "md"
                }
              ],
              backgroundColor: "#2c5494"
            },
            body: {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "text",
                  text: "มีงานใหม่มอบหมายให้คุณ",
                  weight: "bold",
                  size: "xl",
                  margin: "md",
                  color: "#2c5494",
                  wrap: true
                },
                {
                  type: "separator",
                  margin: "md"
                },
                {
                  type: "box",
                  layout: "vertical",
                  margin: "lg",
                  spacing: "sm",
                  contents: [
                    {
                      type: "box",
                      layout: "horizontal",
                      contents: [
                        {
                          type: "text",
                          text: "ทะเบียนรถ",
                          size: "sm",
                          color: "#8c8c8c",
                          flex: 1
                        },
                        {
                          type: "text",
                          text: "ผบ-4104",
                          size: "sm",
                          color: "#111111",
                          flex: 3
                        }
                      ]
                    },
                    {
                      type: "box",
                      layout: "horizontal",
                      contents: [
                        {
                          type: "text",
                          text: "ลูกค้า",
                          size: "sm",
                          color: "#8c8c8c",
                          flex: 1
                        },
                        {
                          type: "text",
                          text: "เนชั่นไวด์ เอ็กซ์เพรส เซอร์วิส จำกัด",
                          size: "sm",
                          color: "#111111",
                          flex: 3,
                          wrap: true
                        }
                      ]
                    },
                    {
                      type: "box",
                      layout: "horizontal",
                      contents: [
                        {
                          type: "text",
                          text: "ต้นทาง",
                          size: "sm",
                          color: "#8c8c8c",
                          flex: 1
                        },
                        {
                          type: "text",
                          text: "กรุงเทพฯ",
                          size: "sm",
                          color: "#111111",
                          flex: 3,
                          wrap: true
                        }
                      ]
                    },
                    {
                      type: "box",
                      layout: "horizontal",
                      contents: [
                        {
                          type: "text",
                          text: "ปลายทาง",
                          size: "sm",
                          color: "#8c8c8c",
                          flex: 1
                        },
                        {
                          type: "text",
                          text: "เชียงใหม่",
                          size: "sm",
                          color: "#111111",
                          flex: 3,
                          wrap: true
                        }
                      ]
                    },
                    {
                      type: "box",
                      layout: "horizontal",
                      contents: [
                        {
                          type: "text",
                          text: "วันที่",
                          size: "sm",
                          color: "#8c8c8c",
                          flex: 1
                        },
                        {
                          type: "text",
                          text: "2026-03-14",
                          size: "sm",
                          color: "#111111",
                          flex: 3
                        }
                      ]
                    },
                    {
                      type: "box",
                      layout: "horizontal",
                      contents: [
                        {
                          type: "text",
                          text: "คนขับ",
                          size: "sm",
                          color: "#8c8c8c",
                          flex: 1
                        },
                        {
                          type: "text",
                          text: "ทดสอบ ระบบ",
                          size: "sm",
                          color: "#111111",
                          flex: 3
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            footer: {
              type: "box",
              layout: "vertical",
              spacing: "sm",
              contents: [
                {
                  type: "button",
                  style: "primary",
                  height: "sm",
                  color: "#e54d42",
                  action: {
                    type: "uri",
                    label: "เข้าสู่ระบบ",
                    uri: "https://app.nesxp.com/"
                  }
                }
              ],
              flex: 0
            }
          }
        }
      ];

      await axios.post('/api/line/send', {
        to: testLineId,
        messages: messages
      });
      setTestStatus({ type: 'success', message: 'LINE messages sent successfully!' });
    } catch (error: any) {
      console.error('Failed to test LINE:', error);
      const details = error.response?.data?.details;
      const errorDetails = typeof details === 'object' ? JSON.stringify(details) : (details || error.message);
      setTestStatus({ type: 'error', message: `Failed: ${errorDetails}` });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('line_settings')}</h1>
          <p className="text-slate-500">{t('line_config_desc')}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{t('line_notifications')}</h2>
              <p className="text-sm text-slate-500">Manage how the system sends LINE notifications to drivers</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="space-y-0.5">
              <label className="text-base font-semibold text-slate-900">
                {t('enable_line_notifications')}
              </label>
              <p className="text-sm text-slate-500">
                {t('line_notification_will_be_sent')}
              </p>
            </div>
            <button
              onClick={() => setIsEnabled(!isEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                isEnabled ? 'bg-primary' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100 text-amber-800">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-semibold">Important Note</p>
              <p className="opacity-90">
                LINE notifications require a valid LINE Messaging API Channel Access Token configured in the system environment. 
                Disabling this will stop all automated LINE notifications immediately.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6 border-t border-slate-100">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-slate-700 font-semibold">
              <Send className="w-4 h-4" />
              <h3>Test LINE Configuration</h3>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="LINE User ID (e.g. U1234567890abcdef...)"
                  value={testLineId}
                  onChange={(e) => setTestLineId(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary pr-32"
                />
                <button 
                  onClick={() => driverLineId && setTestLineId(driverLineId)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                  title="Click to use this ID"
                >
                  <User className="w-3 h-3" />
                  <span>Driver: {driverLineId ? `${driverLineId.substring(0, 8)}...` : 'N/A'}</span>
                </button>
              </div>
              <button
                onClick={handleTestLine}
                disabled={isTesting || !testLineId}
                className="px-6 py-2 bg-slate-800 text-white rounded-xl font-semibold hover:bg-slate-900 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Test
              </button>
            </div>
            {testStatus && (
              <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
                testStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
              }`}>
                {testStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {testStatus.message}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 shadow-sm"
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {t('save')}
          </button>
        </div>
      </div>

      {showSuccess && (
        <div className="fixed bottom-8 right-8 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
          <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
            <Save className="w-4 h-4" />
          </div>
          <span className="font-medium">{t('save_success')}</span>
        </div>
      )}
    </div>
  );
};
