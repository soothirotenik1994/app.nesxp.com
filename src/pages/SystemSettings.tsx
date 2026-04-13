import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, Save, Loader2, CheckCircle2, Globe, Key, AlertCircle, Upload, Image as ImageIcon, Link as LinkIcon, MessageSquare, MapPin } from 'lucide-react';
import { directusApi } from '../api/directus';
import { LineSettings } from './LineSettings';

export const SystemSettings: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'general' | 'line'>('general');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    directusUrl: localStorage.getItem('directus_url') || import.meta.env.VITE_DIRECTUS_URL || 'https://data.nesxp.com',
    staticApiKey: localStorage.getItem('static_api_key') || 'KC7bsoqj_bmFeKWJcDGadyxXZsleRUi4',
    websiteName: localStorage.getItem('website_name') || 'NES Tracking',
    websiteLogo: localStorage.getItem('website_logo') || 'https://img2.pic.in.th/4863801.jpg',
    websiteBackground: localStorage.getItem('website_background') || '',
    appUrl: localStorage.getItem('app_url') || window.location.origin,
    googleMapsApiKey: localStorage.getItem('google_maps_api_key') || '',
    enableQueueSystem: localStorage.getItem('enable_queue_system') !== 'false', // Default true
    bkkMaxDistance: parseInt(localStorage.getItem('bkk_max_distance') || '250', 10),
    enableTracking: localStorage.getItem('enable_tracking') !== 'false', // Default true
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings = await directusApi.getSystemSettings();
        console.log('Fetched settings from Directus:', settings);
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
          }));
          
          // Sync to localStorage for immediate use in app
          localStorage.setItem('website_name', settings.website_name || '');
          localStorage.setItem('website_logo', settings.website_logo || '');
          localStorage.setItem('website_background', settings.website_background || '');
          localStorage.setItem('app_url', settings.app_url || '');
          localStorage.setItem('google_maps_api_key', settings.google_maps_api_key || '');
          localStorage.setItem('enable_queue_system', settings.enable_queue_system !== undefined ? String(settings.enable_queue_system) : 'true');
          localStorage.setItem('bkk_max_distance', settings.bkk_max_distance !== undefined ? String(settings.bkk_max_distance) : '250');
          localStorage.setItem('enable_tracking', settings.enable_tracking !== undefined ? String(settings.enable_tracking) : 'true');
        }
      } catch (error: any) {
        if (error.response?.status === 401) {
          return;
        }
        console.error('Failed to fetch settings from Directus:', error);
      }
    };
    fetchSettings();
  }, []);

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
      const errorMsg = error.response?.data?.errors?.[0]?.message || error.message || 'Failed to upload file';
      alert(`Upload Error: ${errorMsg}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save to Directus
      await directusApi.updateSystemSettings({
        website_name: formData.websiteName,
        website_logo: formData.websiteLogo,
        website_background: formData.websiteBackground,
        app_url: formData.appUrl,
        google_maps_api_key: formData.googleMapsApiKey,
        enable_queue_system: formData.enableQueueSystem,
        bkk_max_distance: formData.bkkMaxDistance,
        enable_tracking: formData.enableTracking,
      });

      // Save to localStorage
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
      
      setTimeout(() => {
        setIsSaving(false);
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          window.location.reload(); // Reload to apply new settings to API client
        }, 1500);
      }, 800);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setIsSaving(false);
      alert('Failed to save settings to Directus. Please check your permissions or if the collection "system_settings" exists.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('system_settings')}</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-6 py-2 rounded-xl font-semibold transition-all ${
            activeTab === 'general' 
              ? 'bg-white text-primary shadow-sm' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Settings className="w-4 h-4" />
          {t('general_settings')}
        </button>
        <button
          onClick={() => setActiveTab('line')}
          className={`flex items-center gap-2 px-6 py-2 rounded-xl font-semibold transition-all ${
            activeTab === 'line' 
              ? 'bg-white text-primary shadow-sm' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          ตั้งค่า API LINE
        </button>
      </div>

      {activeTab === 'general' ? (
        <>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Website Branding</h2>
              <p className="text-sm text-slate-500">Customize your website name and logo</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                Website Name
              </label>
              <input 
                type="text" 
                value={formData.websiteName}
                onChange={(e) => setFormData({...formData, websiteName: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                placeholder="NES Tracking"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                Website Logo
              </label>
              <div className="flex gap-3">
                <input 
                  type="text" 
                  value={formData.websiteLogo}
                  onChange={(e) => setFormData({...formData, websiteLogo: e.target.value})}
                  className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                  placeholder="https://example.com/logo.png"
                />
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={(e) => handleFileUpload(e, 'websiteLogo')}
                  className="hidden"
                  accept="image/*"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-4 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all flex items-center gap-2 border border-slate-200 disabled:opacity-50"
                >
                  {isUploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                  Upload
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                Website Background
              </label>
              <div className="flex gap-3">
                <input 
                  type="text" 
                  value={formData.websiteBackground}
                  onChange={(e) => setFormData({...formData, websiteBackground: e.target.value})}
                  className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                  placeholder="https://example.com/background.jpg"
                />
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={(e) => handleFileUpload(e, 'websiteBackground')}
                  className="hidden"
                  accept="image/*"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-4 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all flex items-center gap-2 border border-slate-200 disabled:opacity-50"
                >
                  {isUploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                  Upload
                </button>
              </div>
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
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
              placeholder="https://your-app-url.com"
            />
            <p className="text-[10px] text-slate-400">Used for generating deep links and LINE notifications</p>
          </div>
          
          <div className="flex gap-6">
            {formData.websiteLogo && (
              <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 inline-block">
                <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">Logo Preview</p>
                <div className="w-20 h-20 bg-white rounded-lg border border-slate-200 flex items-center justify-center p-2 overflow-hidden">
                  <img 
                    src={formData.websiteLogo} 
                    alt="Logo Preview" 
                    className="max-w-full max-h-full object-contain"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=Invalid+URL';
                    }}
                  />
                </div>
              </div>
            )}
            
            {formData.websiteBackground && (
              <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 inline-block">
                <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">Background Preview</p>
                <div className="w-20 h-20 bg-white rounded-lg border border-slate-200 flex items-center justify-center p-2 overflow-hidden">
                  <img 
                    src={formData.websiteBackground} 
                    alt="Background Preview" 
                    className="max-w-full max-h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=Invalid+URL';
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-6">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">ฟีเจอร์ระบบ (System Features)</h2>
              <p className="text-sm text-slate-500">เปิด/ปิดการใช้งานฟีเจอร์ต่างๆ ภายในระบบ</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-slate-200 rounded-xl bg-slate-50">
            <div>
              <h3 className="font-semibold text-slate-900">ระบบจัดลำดับคิวรถอัตโนมัติ (Queue System)</h3>
              <p className="text-sm text-slate-500 mt-1">
                เปิดเพื่อใช้ระบบคำนวณและแนะนำคิวรถอัตโนมัติในหน้าจ่ายงาน (คำนวณจากประวัติการวิ่งงาน กทม. และ ตจว.)
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer mt-4 sm:mt-0">
              <input 
                type="checkbox" 
                className="sr-only peer"
                checked={formData.enableQueueSystem}
                onChange={(e) => setFormData({...formData, enableQueueSystem: e.target.checked})}
              />
              <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-slate-200 rounded-xl bg-slate-50">
            <div>
              <h3 className="font-semibold text-slate-900">ระยะทางสูงสุดสำหรับงาน กทม./ปริมณฑล (กิโลเมตร)</h3>
              <p className="text-sm text-slate-500 mt-1">
                ใช้สำหรับแยกระหว่างงาน กทม. และงานต่างจังหวัด ในระบบจัดคิวรถ (ค่าเริ่มต้น: 250 กม.)
              </p>
            </div>
            <div className="mt-4 sm:mt-0 flex items-center gap-2">
              <input
                type="number"
                min="1"
                value={formData.bkkMaxDistance}
                onChange={(e) => setFormData({...formData, bkkMaxDistance: parseInt(e.target.value) || 0})}
                className="w-24 px-4 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-primary transition-all text-center font-semibold text-slate-700"
              />
              <span className="text-slate-500 font-medium">กม.</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-slate-200 rounded-xl bg-slate-50">
            <div>
              <h3 className="font-semibold text-slate-900">ระบบติดตามพัสดุ (Tracking System)</h3>
              <p className="text-sm text-slate-500 mt-1">
                เปิดเพื่อแสดงแท็บ "ติดตามพัสดุ" ในหน้าเข้าสู่ระบบ (Login) ให้ลูกค้าสามารถค้นหาสถานะงานได้
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer mt-4 sm:mt-0">
              <input 
                type="checkbox" 
                className="sr-only peer"
                checked={formData.enableTracking}
                onChange={(e) => setFormData({...formData, enableTracking: e.target.checked})}
              />
              <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-6">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">API Configuration</h2>
              <p className="text-sm text-slate-500">Manage Directus backend connection and authentication</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Globe className="w-4 h-4 text-slate-400" />
                Directus URL
              </label>
              <input 
                type="text" 
                value={formData.directusUrl}
                onChange={(e) => setFormData({...formData, directusUrl: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                placeholder="https://your-directus-instance.com"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Key className="w-4 h-4 text-slate-400" />
                Static API Key (Access Token)
              </label>
              <input 
                type="password" 
                value={formData.staticApiKey}
                onChange={(e) => setFormData({...formData, staticApiKey: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                placeholder="Enter your Directus static token"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400" />
                Google Maps API Key
              </label>
              <input 
                type="password" 
                value={formData.googleMapsApiKey}
                onChange={(e) => setFormData({...formData, googleMapsApiKey: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                placeholder="Enter your Google Maps API Key"
              />
              <p className="text-[10px] text-slate-400">ใช้สำหรับคำนวณระยะทางจริงและจัดลำดับเส้นทางอัตโนมัติ (Route Optimization)</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100 text-blue-800">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-semibold">Note on Changes</p>
              <p className="opacity-90">
                Saving these settings will update the connection parameters for all API requests. 
                The application will automatically reload to apply the new configuration.
              </p>
            </div>
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
      </>
      ) : (
        <LineSettings hideHeader={true} />
      )}

      {showSuccess && (
        <div className="fixed bottom-8 right-8 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
          <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <span className="font-medium">{t('save_success')}</span>
        </div>
      )}
    </div>
  );
};
