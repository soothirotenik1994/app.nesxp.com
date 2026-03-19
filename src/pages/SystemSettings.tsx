import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, Save, Loader2, CheckCircle2, Globe, Key, AlertCircle, Upload, Image as ImageIcon } from 'lucide-react';
import { directusApi } from '../api/directus';

export const SystemSettings: React.FC = () => {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    directusUrl: localStorage.getItem('directus_url') || import.meta.env.VITE_DIRECTUS_URL || 'https://data.nesxp.com',
    staticApiKey: localStorage.getItem('static_api_key') || 'KC7bsoqj_bmFeKWJcDGadyxXZsleRUi4',
    websiteName: localStorage.getItem('website_name') || 'NES Tracking',
    websiteLogo: localStorage.getItem('website_logo') || 'https://img2.pic.in.th/4863801.jpg',
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const uploadedFile = await directusApi.uploadFile(file);
      const fileUrl = directusApi.getFileUrl(uploadedFile.id);
      setFormData({ ...formData, websiteLogo: fileUrl });
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload logo. Please check your Directus permissions.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = () => {
    setIsSaving(true);
    localStorage.setItem('directus_url', formData.directusUrl);
    localStorage.setItem('static_api_key', formData.staticApiKey);
    localStorage.setItem('website_name', formData.websiteName);
    localStorage.setItem('website_logo', formData.websiteLogo);
    
    setTimeout(() => {
      setIsSaving(false);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        window.location.reload(); // Reload to apply new settings to API client
      }, 1500);
    }, 800);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('system_settings')}</h1>
          <p className="text-slate-500">Configure core system parameters and website branding</p>
        </div>
      </div>

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
                  onChange={handleFileUpload}
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
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
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
