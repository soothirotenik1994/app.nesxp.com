import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, Save, Loader2, CheckCircle2, Globe, Key, AlertCircle, Upload, Image as ImageIcon, Link as LinkIcon, MessageSquare, MapPin, History } from 'lucide-react';
import { directusApi } from '../api/directus';
import { cn } from '../lib/utils';
import { LineSettings } from './LineSettings';

export const SystemSettings: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'general' | 'line' | 'smtp' | 'logs'>('general');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isTestingGps, setIsTestingGps] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState(() => {
    let key = localStorage.getItem('static_api_key');
    const badTokens = [
      '1US7kkCXks43DIJBn0XZlc0nQhAWA9x0',
      'JwVz29Z6wVy_QpOqxc1J9sw-BAt3v8nn',
      'KC7bsoqj_bmFeKWJCDGadyxXZsleRUi4'
    ];
    if (key && badTokens.includes(key)) {
      localStorage.removeItem('static_api_key');
      key = null;
    }
    const envKey = (import.meta.env.VITE_DIRECTUS_STATIC_TOKEN || '').trim();
    const finalKey = key || (badTokens.includes(envKey) ? null : envKey) || 'r0eWclUwYkWhUWVlaYkzgOJzAKpRtEex';
    
    return {
      directusUrl: localStorage.getItem('directus_url') || import.meta.env.VITE_DIRECTUS_URL || 'https://data.nesxp.com',
      staticApiKey: finalKey,
      websiteName: localStorage.getItem('website_name') || 'NES Tracking',
      websiteLogo: localStorage.getItem('website_logo') || 'https://img2.pic.in.th/4863801.jpg',
      websiteBackground: localStorage.getItem('website_background') || '',
      appUrl: localStorage.getItem('app_url') || window.location.origin,
      googleMapsApiKey: localStorage.getItem('google_maps_api_key') || '',
      enableQueueSystem: localStorage.getItem('enable_queue_system') !== 'false',
      bkkMaxDistance: parseInt(localStorage.getItem('bkk_max_distance') || '250', 10),
      enableTracking: localStorage.getItem('enable_tracking') !== 'false',
      enableLineLogin: localStorage.getItem('enable_line_login') !== 'false',
      enableGoogleLogin: localStorage.getItem('enable_google_login') === 'true',
      googleClientId: localStorage.getItem('google_client_id') || import.meta.env.VITE_GOOGLE_CLIENT_ID || '559675370597-bs7c8aabdco373h9vc81gb09kbp62dte.apps.googleusercontent.com',
      emailSmtpHost: localStorage.getItem('email_smtp_host') || '',
      emailSmtpPort: localStorage.getItem('email_smtp_port') || '587',
      emailSmtpUser: localStorage.getItem('email_smtp_user') || '',
      emailSmtpPassword: localStorage.getItem('email_smtp_password') || '',
      emailSmtpSecure: localStorage.getItem('email_smtp_secure') === 'true',
      emailFrom: localStorage.getItem('email_from') || '',
      emailFromName: localStorage.getItem('email_from_name') || '',
      mapUpdateInterval: parseInt(localStorage.getItem('map_update_interval') || '10', 10),
      gpsApiToken: localStorage.getItem('gps_api_token') || 'f184dc44-454a-7a69-50c5-0d5087c1e20b',
    };
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings = await directusApi.getSystemSettings();
        if (settings) {
          setFormData(prev => ({
            ...prev,
            websiteName: settings.website_name || prev.websiteName,
            websiteLogo: settings.website_logo || prev.websiteLogo,
            websiteBackground: settings.website_background || prev.websiteBackground,
            appUrl: settings.app_url || prev.appUrl,
            googleMapsApiKey: settings.google_maps_api_key || prev.googleMapsApiKey,
            enableQueueSystem: settings.enable_queue_system !== undefined ? settings.enable_queue_system : prev.enableQueueSystem,
            bkkMaxDistance: settings.bkk_max_distance !== undefined ? settings.bkk_max_distance : prev.bkkMaxDistance,
            enableTracking: settings.enable_tracking !== undefined ? settings.enable_tracking : prev.enableTracking,
            enableLineLogin: settings.enable_line_login !== undefined ? settings.enable_line_login : prev.enableLineLogin,
            enableGoogleLogin: settings.enable_google_login !== undefined ? settings.enable_google_login : prev.enableGoogleLogin,
            googleClientId: settings.google_client_id || prev.googleClientId,
            emailSmtpHost: settings.email_smtp_host || prev.emailSmtpHost,
            emailSmtpPort: settings.email_smtp_port || prev.emailSmtpPort,
            emailSmtpUser: settings.email_smtp_user || prev.emailSmtpUser,
            emailSmtpPassword: settings.email_smtp_password || prev.emailSmtpPassword,
            emailSmtpSecure: settings.email_smtp_secure !== undefined ? settings.email_smtp_secure : prev.emailSmtpSecure,
            emailFrom: settings.email_from || prev.emailFrom,
            emailFromName: settings.email_from_name || prev.emailFromName,
            mapUpdateInterval: settings.map_update_interval !== undefined ? settings.map_update_interval : prev.mapUpdateInterval,
            gpsApiToken: settings.gps_api_token || prev.gpsApiToken,
          }));
          
          Object.keys(settings).forEach(key => {
            if (settings[key] !== undefined) {
              const storageKey = key === 'expense_categories' ? 'expense_categories' : key;
              localStorage.setItem(storageKey, String(settings[key]));
            }
          });
        }
      } catch (error: any) {
        console.error('Failed to fetch settings from Directus:', error);
      }
    };
    fetchSettings();
  }, []);

// src/pages/SystemSettings.tsx

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'websiteLogo' | 'websiteBackground') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileId = await directusApi.uploadFile(file);
      const fileUrl = directusApi.getFileUrl(fileId);
      setFormData({ ...formData, [field]: fileUrl });
    } catch (error: any) {
      console.error('Error uploading file:', error);
      alert(`Upload Error: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await directusApi.updateSystemSettings({
        website_name: formData.websiteName,
        website_logo: formData.websiteLogo,
        website_background: formData.websiteBackground,
        app_url: formData.appUrl,
        google_maps_api_key: formData.googleMapsApiKey,
        enable_queue_system: formData.enableQueueSystem,
        bkk_max_distance: formData.bkkMaxDistance,
        enable_tracking: formData.enableTracking,
        enable_line_login: formData.enableLineLogin,
        enable_google_login: formData.enableGoogleLogin,
        google_client_id: formData.googleClientId,
        email_smtp_host: formData.emailSmtpHost,
        email_smtp_port: formData.emailSmtpPort,
        email_smtp_user: formData.emailSmtpUser,
        email_smtp_password: formData.emailSmtpPassword,
        email_smtp_secure: formData.emailSmtpSecure,
        email_from: formData.emailFrom,
        email_from_name: formData.emailFromName,
        map_update_interval: formData.mapUpdateInterval,
        gps_api_token: formData.gpsApiToken,
      });

      localStorage.setItem('directus_url', formData.directusUrl);
      localStorage.setItem('static_api_key', formData.staticApiKey);
      localStorage.setItem('website_name', formData.websiteName);
      localStorage.setItem('website_logo', formData.websiteLogo);
      localStorage.setItem('website_background', formData.websiteBackground);
      localStorage.setItem('app_url', formData.appUrl);
      localStorage.setItem('google_maps_api_key', formData.googleMapsApiKey);
      localStorage.setItem('enable_queue_system', String(formData.enableQueueSystem));
      localStorage.setItem('bkk_max_distance', String(formData.bkkMaxDistance));
      localStorage.setItem('enable_tracking', String(formData.enableTracking));
      localStorage.setItem('enable_line_login', String(formData.enableLineLogin));
      localStorage.setItem('enable_google_login', String(formData.enableGoogleLogin));
      localStorage.setItem('google_client_id', formData.googleClientId);
      localStorage.setItem('email_smtp_host', formData.emailSmtpHost);
      localStorage.setItem('email_smtp_port', formData.emailSmtpPort);
      localStorage.setItem('email_smtp_user', formData.emailSmtpUser);
      localStorage.setItem('email_smtp_password', formData.emailSmtpPassword);
      localStorage.setItem('email_smtp_secure', String(formData.emailSmtpSecure));
      localStorage.setItem('email_from', formData.emailFrom);
      localStorage.setItem('email_from_name', formData.emailFromName);
      localStorage.setItem('map_update_interval', String(formData.mapUpdateInterval));
      localStorage.setItem('gps_api_token', formData.gpsApiToken);
      
      setTimeout(() => {
        setIsSaving(false);
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          window.location.reload();
        }, 1500);
      }, 800);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setIsSaving(false);
      alert('Failed to save settings to Directus.');
    }
  };

  const handleTestGpsConnection = async () => {
    setIsTestingGps(true);
    setGpsStatus(null);
    try {
      const response = await fetch('/api/gps/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: formData.gpsApiToken })
      });
      const data = await response.json();
      setGpsStatus({ success: data.success, message: data.message });
    } catch (error: any) {
      setGpsStatus({ success: false, message: error.message });
    } finally {
      setIsTestingGps(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('system_settings')}</h1>
        </div>
      </div>

      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-6 py-2 rounded-xl font-semibold transition-all ${
            activeTab === 'general' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Settings className="w-4 h-4" />
          {t('general_settings')}
        </button>
        <button
          onClick={() => setActiveTab('line')}
          className={`flex items-center gap-2 px-6 py-2 rounded-xl font-semibold transition-all ${
            activeTab === 'line' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          {t('line_api_settings')}
        </button>
        <button
          onClick={() => setActiveTab('smtp')}
          className={`flex items-center gap-2 px-6 py-2 rounded-xl font-semibold transition-all ${
            activeTab === 'smtp' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Globe className="w-4 h-4" />
          {t('smtp_settings')}
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-6 py-2 rounded-xl font-semibold transition-all ${
            activeTab === 'logs' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <History className="w-4 h-4" />
          {t('login_history')}
        </button>
      </div>

      {activeTab === 'general' ? (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{t('website_branding')}</h2>
                  <p className="text-sm text-slate-500">{t('customize_website_name_logo')}</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">{t('website_name')}</label>
                  <input 
                    type="text" 
                    value={formData.websiteName}
                    onChange={(e) => setFormData({...formData, websiteName: e.target.value})}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">{t('website_logo')}</label>
                  <div className="flex gap-3">
                    <input 
                      type="text" 
                      value={formData.websiteLogo}
                      onChange={(e) => setFormData({...formData, websiteLogo: e.target.value})}
                      className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                    />
                    <input type="file" ref={fileInputRef} onChange={(e) => handleFileUpload(e, 'websiteLogo')} className="hidden" accept="image/*" />
                    <button onClick={() => fileInputRef.current?.click()} className="px-4 py-3 bg-slate-100 text-slate-700 rounded-xl border border-slate-200 hover:bg-slate-200 transition-all flex items-center gap-2">
                      {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                      {t('upload')}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">{t('website_background')}</label>
                <div className="flex gap-3">
                  <input 
                    type="text" 
                    value={formData.websiteBackground}
                    onChange={(e) => setFormData({...formData, websiteBackground: e.target.value})}
                    className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                    placeholder="URL wallpaper"
                  />
                  <input type="file" id="bg-input" onChange={(e) => handleFileUpload(e, 'websiteBackground')} className="hidden" accept="image/*" />
                  <button onClick={() => document.getElementById('bg-input')?.click()} className="px-4 py-3 bg-slate-100 text-slate-700 rounded-xl border border-slate-200 hover:bg-slate-200 transition-all flex items-center gap-2">
                    {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                    {t('upload')}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-slate-400" />
                  {t('app_url')}
                </label>
                <input 
                  type="text" 
                  value={formData.appUrl}
                  onChange={(e) => setFormData({...formData, appUrl: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{t('system_features')}</h2>
                  <p className="text-sm text-slate-500">{t('system_features_desc')}</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-slate-200 rounded-xl bg-white">
                <div>
                  <h3 className="font-semibold text-slate-900">{t('queue_system')}</h3>
                  <p className="text-sm text-slate-500 mt-1">{t('queue_system_desc')}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer mt-4 sm:mt-0">
                  <input type="checkbox" className="sr-only peer" checked={formData.enableQueueSystem} onChange={(e) => setFormData({...formData, enableQueueSystem: e.target.checked})} />
                  <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-slate-200 rounded-xl bg-white">
                <div>
                  <h3 className="font-semibold text-slate-900">{t('bkk_max_distance_label')}</h3>
                  <p className="text-sm text-slate-500 mt-1">{t('bkk_max_distance_desc')}</p>
                </div>
                <div className="mt-4 sm:mt-0 flex items-center gap-2">
                  <input type="number" value={formData.bkkMaxDistance} onChange={(e) => setFormData({...formData, bkkMaxDistance: parseInt(e.target.value) || 0})} className="w-24 px-4 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-primary transition-all text-center" />
                  <span className="text-slate-500">{t('km')}</span>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-slate-200 rounded-xl bg-white">
                <div>
                  <h3 className="font-semibold text-slate-900">{t('google_login_setting')}</h3>
                  <p className="text-sm text-slate-500 mt-1">{t('google_login_setting_desc')}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer mt-4 sm:mt-0">
                  <input type="checkbox" className="sr-only peer" checked={formData.enableGoogleLogin} onChange={(e) => setFormData({...formData, enableGoogleLogin: e.target.checked})} />
                  <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-slate-200 rounded-xl bg-white">
                <div>
                  <h3 className="font-semibold text-slate-900">{t('map_update_interval')}</h3>
                  <p className="text-sm text-slate-500 mt-1">{t('map_update_interval_desc')}</p>
                </div>
                <div className="mt-4 sm:mt-0 flex items-center gap-2">
                  <input 
                    type="number" 
                    value={formData.mapUpdateInterval} 
                    onChange={(e) => setFormData({...formData, mapUpdateInterval: parseInt(e.target.value) || 5})} 
                    className="w-24 px-4 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-primary transition-all text-center"
                    min="5"
                  />
                  <span className="text-slate-500">{t('seconds')}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{t('api_configuration')}</h2>
                  <p className="text-sm text-slate-500">{t('manage_directus_connection')}</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-slate-400" />
                    {t('directus_url')}
                  </label>
                  <input type="text" value={formData.directusUrl} onChange={(e) => setFormData({...formData, directusUrl: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Key className="w-4 h-4 text-slate-400" />
                    {t('static_api_key')}
                  </label>
                  <input type="password" value={formData.staticApiKey} onChange={(e) => setFormData({...formData, staticApiKey: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    {t('google_maps_api_key')}
                  </label>
                  <input type="password" value={formData.googleMapsApiKey} onChange={(e) => setFormData({...formData, googleMapsApiKey: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Key className="w-4 h-4 text-slate-400" />
                    {t('gps_api_token')} (eupfin.com)
                  </label>
                  <div className="flex gap-3">
                    <input 
                      type="password" 
                      value={formData.gpsApiToken} 
                      onChange={(e) => setFormData({...formData, gpsApiToken: e.target.value})} 
                      className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all" 
                    />
                    <button
                      onClick={handleTestGpsConnection}
                      disabled={isTestingGps}
                      className="px-4 py-3 bg-slate-100 text-slate-700 rounded-xl border border-slate-200 hover:bg-slate-200 transition-all flex items-center gap-2 whitespace-nowrap min-w-[140px] justify-center"
                    >
                      {isTestingGps ? <Loader2 className="w-5 h-5 animate-spin" /> : <Globe className="w-5 h-5" />}
                      {isTestingGps ? t('testing') : t('test_connection')}
                    </button>
                  </div>
                  {gpsStatus && (
                    <div className={cn(
                      "mt-2 p-3 rounded-lg text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-1",
                      gpsStatus.success ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100"
                    )}>
                      {gpsStatus.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      <span className="font-medium">{gpsStatus.success ? t('connection_success') : t('connection_failed')}: {gpsStatus.message}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100 text-blue-800">
                <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div className="text-sm font-medium">{t('note_on_changes_desc')}</div>
              </div>
            </div>
            <div className="p-6 bg-white border-t border-slate-100 flex justify-end">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-all shadow-sm"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      ) : activeTab === 'smtp' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-500">
          <div className="p-6 border-b border-slate-100 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{t('smtp_settings')}</h2>
                <p className="text-sm text-slate-500">{t('manage_smtp_settings')}</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">{t('smtp_host')}</label>
                <input type="text" value={formData.emailSmtpHost} onChange={(e) => setFormData({...formData, emailSmtpHost: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">{t('smtp_port')}</label>
                <input type="text" value={formData.emailSmtpPort} onChange={(e) => setFormData({...formData, emailSmtpPort: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">{t('smtp_user')}</label>
                <input type="text" value={formData.emailSmtpUser} onChange={(e) => setFormData({...formData, emailSmtpUser: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">{t('smtp_password')}</label>
                <input type="password" value={formData.emailSmtpPassword} onChange={(e) => setFormData({...formData, emailSmtpPassword: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none" />
              </div>
            </div>
            <div className="p-6 bg-white border-t border-slate-100 flex justify-end">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-all shadow-sm"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      ) : activeTab === 'logs' ? (
        <div className="animate-in fade-in duration-500">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{t('login_history')}</h2>
                  <p className="text-sm text-slate-500">{t('manage_login_history')}</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="bg-slate-50 rounded-xl p-8 text-center border border-slate-200 border-dashed">
                <p className="text-slate-600 mb-4">{t('view_all_login_logs_desc')}</p>
                <button onClick={() => window.location.href = '/settings/logs'} className="px-6 py-2.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-all shadow-sm flex items-center gap-2 mx-auto">
                  <History className="w-5 h-5" />
                  {t('view_login_history')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <LineSettings hideHeader={true} />
      )}

      {showSuccess && (
        <div className="fixed bottom-8 right-8 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium">{t('save_success')}</span>
        </div>
      )}
    </div>
  );
};
