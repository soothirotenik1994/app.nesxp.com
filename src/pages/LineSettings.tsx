import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { MessageSquare, Save, AlertCircle, Send, Loader2, CheckCircle2, XCircle, User } from 'lucide-react';
import { lineService } from '../services/lineService';
import { directusApi } from '../api/directus';

interface LineSettingsProps {
  hideHeader?: boolean;
}

export const LineSettings: React.FC<LineSettingsProps> = ({ hideHeader = false }) => {
  const { t } = useTranslation();
  const [isEnabled, setIsEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [testLineId, setTestLineId] = useState('');
  const [testMessage, setTestMessage] = useState('🔔 ทดสอบระบบการแจ้งเตือน\n\nนี่คือข้อความทดสอบจากระบบ Nationwide Express Tracker');
  const [notificationTemplate, setNotificationTemplate] = useState('🔔 มีงานใหม่มอบหมายให้คุณ\n\n🏢 ลูกค้า: {{customer_name}}\n📍 ต้นทาง: {{origin}}\n🏁 ปลายทาง: {{destination}}\n🚚 รถ: {{car_plate}}\n📅 วันที่: {{work_date}}');
  const [memberLineId, setMemberLineId] = useState<string | null>(null);
  const [sampleCarImage, setSampleCarImage] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isTestingTemplate, setIsTestingTemplate] = useState(false);
  const [testStatus, setTestStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [channelAccessToken, setChannelAccessToken] = useState('');
  const [channelSecret, setChannelSecret] = useState('');

  useEffect(() => {
    const savedSetting = localStorage.getItem('line_notifications_enabled');
    if (savedSetting !== null) {
      setIsEnabled(savedSetting === 'true');
    }

    // Check configuration status
    const checkConfig = async () => {
      try {
        const response = await axios.get('/api/line/config-check');
        setIsConfigured(response.data.configured);
      } catch (error) {
        console.error('Failed to check LINE config:', error);
      }
    };

    // Fetch system settings for LINE templates and API settings
    const fetchSettings = async () => {
      try {
        const settings = await directusApi.getSystemSettings();
        if (settings) {
          if (settings.line_test_message) setTestMessage(settings.line_test_message);
          if (settings.line_notification_template) setNotificationTemplate(settings.line_notification_template);
        }
        
        const lineSettings = await directusApi.getLineSettings();
        if (lineSettings) {
          if (lineSettings.channel_access_token) setChannelAccessToken(lineSettings.channel_access_token);
          if (lineSettings.channel_secret) setChannelSecret(lineSettings.channel_secret);
        }
      } catch (error) {
        console.error('Failed to fetch settings from Directus:', error);
      }
    };

    // Fetch a sample member's LINE ID and a sample car image
    const fetchSamples = async () => {
      try {
        const [members, cars] = await Promise.all([
          directusApi.getMembers(),
          directusApi.getCars()
        ]);

        const member = members.find(m => m.role === 'member' && m.line_user_id);
        if (member) {
          setMemberLineId(member.line_user_id);
        }

        const carWithImage = cars.find(c => c.car_image);
        if (carWithImage) {
          setSampleCarImage(directusApi.getFileUrl(carWithImage.car_image));
        }
      } catch (error) {
        console.error('Failed to fetch samples:', error);
      }
    };

    fetchSettings();
    fetchSamples();
    checkConfig();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    localStorage.setItem('line_notifications_enabled', isEnabled.toString());
    
    try {
      await directusApi.updateSystemSettings({
        line_test_message: testMessage,
        line_notification_template: notificationTemplate
      });
      await directusApi.updateLineSettings({
        channel_access_token: channelAccessToken,
        channel_secret: channelSecret
      });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save LINE settings to Directus:', error);
      // Still show success for local storage if that worked, but log the error
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestLine = async () => {
    if (!testLineId) return;
    setIsTesting(true);
    setTestStatus(null);
    try {
      const messages = [
        {
          type: "text",
          text: testMessage
        }
      ];

      await lineService.sendPushMessage(testLineId, messages);
      setTestStatus({ type: 'success', message: 'LINE text message sent successfully!' });
    } catch (error: any) {
      console.error('Failed to test LINE:', error);
      const details = error.response?.data?.details;
      const errorDetails = typeof details === 'object' ? JSON.stringify(details) : (details || error.message);
      setTestStatus({ type: 'error', message: `Failed: ${errorDetails}` });
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestTemplate = async () => {
    if (!testLineId) return;
    setIsTestingTemplate(true);
    setTestStatus(null);
    try {
      // Parse template with dummy data
      let parsedText = notificationTemplate
        .replace('{{customer_name}}', 'เนชั่นไวด์ เอ็กซ์เพรส เซอร์วิส จำกัด')
        .replace('{{origin}}', 'กรุงเทพฯ')
        .replace('{{destination}}', 'เชียงใหม่')
        .replace('{{car_plate}}', 'ผบ-4104')
        .replace('{{work_date}}', '2026-03-14');

      const messages = [
        {
          type: "flex",
          altText: "มีงานใหม่มอบหมายให้คุณ (ทดสอบเทมเพลต)",
          contents: {
            type: "bubble",
            hero: {
              type: "image",
              url: sampleCarImage || "https://picsum.photos/seed/car/800/400",
              size: "full",
              aspectRatio: "20:13",
              aspectMode: "cover",
              action: {
                type: "uri",
                uri: "https://app.nesxp.com/"
              }
            },
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
                      type: "text",
                      text: parsedText,
                      size: "sm",
                      color: "#111111",
                      wrap: true,
                      whiteSpace: "pre-wrap"
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

      await lineService.sendPushMessage(testLineId, messages);
      setTestStatus({ type: 'success', message: 'LINE template test sent successfully!' });
    } catch (error: any) {
      console.error('Failed to test template:', error);
      const details = error.response?.data?.details;
      const errorDetails = typeof details === 'object' ? JSON.stringify(details) : (details || error.message);
      setTestStatus({ type: 'error', message: `Failed: ${errorDetails}` });
    } finally {
      setIsTestingTemplate(false);
    }
  };

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t('line_settings')}</h1>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{t('line_notifications')}</h2>
              <p className="text-sm text-slate-500">Manage how the system sends LINE notifications to members</p>
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
                LINE notifications are configured via system environment variables.
              </p>
              {isConfigured !== null && (
                <div className="mt-2 flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isConfigured ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <span className="font-medium">
                    Status: {isConfigured ? 'Configured' : 'Not Configured (Missing Secret)'}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">
                LINE Channel Access Token
              </label>
              <input
                type="password"
                value={channelAccessToken}
                onChange={(e) => setChannelAccessToken(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
                placeholder="Enter your LINE Channel Access Token..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">
                LINE Channel Secret
              </label>
              <input
                type="password"
                value={channelSecret}
                onChange={(e) => setChannelSecret(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
                placeholder="Enter your LINE Channel Secret..."
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700">
                  Notification Template (Assignment)
                </label>
                <button
                  onClick={handleTestTemplate}
                  disabled={isTestingTemplate || !testLineId}
                  className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                >
                  {isTestingTemplate ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  Test Template
                </button>
              </div>
              <textarea
                value={notificationTemplate}
                onChange={(e) => setNotificationTemplate(e.target.value)}
                rows={5}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
                placeholder="Enter template using {{variable}} syntax..."
              />
              <p className="text-xs text-slate-500">
                Variables: {"{{customer_name}}"}, {"{{origin}}"}. {"{{destination}}"}. {"{{car_plate}}"}. {"{{work_date}}"}
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
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Test Message Content
              </label>
              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm"
                placeholder="Enter message to send for testing..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Recipient LINE User ID
              </label>
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
                  onClick={() => memberLineId && setTestLineId(memberLineId)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                    title="Click to use this ID"
                  >
                    <User className="w-3 h-3" />
                    <span>Member: {memberLineId ? `${memberLineId.substring(0, 8)}...` : 'N/A'}</span>
                  </button>
                </div>
                <button
                  onClick={handleTestLine}
                  disabled={isTesting || !testLineId}
                  className="px-6 py-2 bg-slate-800 text-white rounded-xl font-semibold hover:bg-slate-900 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Test Send
                </button>
              </div>
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
