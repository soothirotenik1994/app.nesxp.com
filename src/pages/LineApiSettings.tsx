import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Loader2, Key } from 'lucide-react';
import { directusApi } from '../api/directus';

export const LineApiSettings: React.FC = () => {
  const { t } = useTranslation();
  const [accessToken, setAccessToken] = useState('');
  const [channelSecret, setChannelSecret] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings = await directusApi.getLineSettings();
        if (settings) {
          if (settings.channel_access_token) setAccessToken(settings.channel_access_token);
          if (settings.channel_secret) setChannelSecret(settings.channel_secret);
        }
      } catch (error: any) {
        if (error.response?.status === 401) {
          return;
        }
        console.error('Failed to fetch line settings:', error);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await directusApi.updateLineSettings({
        channel_access_token: accessToken,
        channel_secret: channelSecret
      });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save LINE API settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('line_api_settings')}</h1>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{t('line_api_credentials')}</h2>
              <p className="text-sm text-slate-500">{t('line_api_desc')}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">
              {t('line_channel_token')}
            </label>
            <input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
              placeholder={t('line_channel_token_placeholder')}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">
              {t('line_channel_secret')}
            </label>
            <input
              type="password"
              value={channelSecret}
              onChange={(e) => setChannelSecret(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
              placeholder={t('line_channel_secret_placeholder')}
            />
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 shadow-sm"
          >
            {isSaving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {t('save')}
          </button>
        </div>
      </div>

      {showSuccess && (
        <div className="fixed bottom-8 right-8 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
          <Save className="w-4 h-4" />
          <span className="font-medium">{t('save_success')}</span>
        </div>
      )}
    </div>
  );
};
