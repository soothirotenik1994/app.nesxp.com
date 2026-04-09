import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Code, 
  Copy, 
  Check, 
  ExternalLink, 
  Info, 
  Terminal, 
  Globe, 
  Shield, 
  Zap,
  Play,
  Loader2,
  AlertCircle
} from 'lucide-react';
import axios from 'axios';
import { clsx } from 'clsx';

export const ApiSettings: React.FC = () => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<string | null>(null);
  const [testCaseNumber, setTestCaseNumber] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  const appUrl = window.location.origin;
  const trackingEndpoint = `${appUrl}/api/track/{case_number}`;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleTestApi = async () => {
    if (!testCaseNumber) return;
    setIsTesting(true);
    setTestResult(null);
    setTestError(null);
    try {
      const response = await axios.get(`/api/track/${testCaseNumber}`);
      setTestResult(response.data);
    } catch (error: any) {
      console.error('API Test Error:', error);
      setTestError(error.response?.data?.error || error.message || 'Failed to fetch tracking data');
    } finally {
      setIsTesting(false);
    }
  };

  const curlExample = `curl -X GET "${appUrl}/api/track/NES-2026-001"`;
  
  const jsExample = `fetch("${appUrl}/api/track/NES-2026-001")
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));`;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">API Connection Settings</h1>
          <p className="text-slate-500">Connect your external websites or services to the NES Tracking system</p>
        </div>
      </div>

      {/* Overview Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Public Tracking API</h2>
              <p className="text-sm text-slate-500">Allow external tracking of packages using Case Numbers</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                <Globe className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-900">No Auth Required</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                The tracking API is public and only requires a valid Case Number to retrieve status.
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                <Shield className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-900">Data Privacy</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Only non-sensitive fields (status, origin, destination, times) are exposed via this API.
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                <Code className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-900">Easy Integration</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Simple JSON response format makes it easy to integrate with any platform.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-semibold">
              <Terminal className="w-5 h-5 text-slate-400" />
              <h3>Endpoint URL</h3>
            </div>
            <div className="flex items-center gap-2 p-3 bg-slate-900 text-slate-300 rounded-xl font-mono text-sm group relative">
              <span className="flex-1 overflow-x-auto whitespace-nowrap scrollbar-hide">
                GET {trackingEndpoint}
              </span>
              <button 
                onClick={() => copyToClipboard(trackingEndpoint, 'endpoint')}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
              >
                {copied === 'endpoint' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Integration Examples */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* cURL Example */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-slate-700">
              <Code className="w-4 h-4" />
              <span>cURL Example</span>
            </div>
            <button 
              onClick={() => copyToClipboard(curlExample, 'curl')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              {copied === 'curl' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied === 'curl' ? 'Copied' : 'Copy Code'}
            </button>
          </div>
          <div className="p-4 bg-slate-900">
            <pre className="text-xs text-blue-400 font-mono overflow-x-auto">
              {curlExample}
            </pre>
          </div>
        </div>

        {/* JavaScript Example */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-slate-700">
              <Code className="w-4 h-4" />
              <span>JavaScript (Fetch)</span>
            </div>
            <button 
              onClick={() => copyToClipboard(jsExample, 'js')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              {copied === 'js' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied === 'js' ? 'Copied' : 'Copy Code'}
            </button>
          </div>
          <div className="p-4 bg-slate-900">
            <pre className="text-xs text-emerald-400 font-mono overflow-x-auto">
              {jsExample}
            </pre>
          </div>
        </div>
      </div>

      {/* API Tester */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
              <Play className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">API Tester</h2>
              <p className="text-sm text-slate-500">Test the tracking API with a real Case Number</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text" 
              placeholder="Enter Case Number (e.g. NES-2026-001)"
              value={testCaseNumber}
              onChange={(e) => setTestCaseNumber(e.target.value)}
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
            <button 
              onClick={handleTestApi}
              disabled={isTesting || !testCaseNumber}
              className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isTesting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
              Test API
            </button>
          </div>

          {testError && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600">
              <AlertCircle className="w-5 h-5 mt-0.5" />
              <div className="text-sm">
                <p className="font-bold">Error</p>
                <p>{testError}</p>
              </div>
            </div>
          )}

          {testResult && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Response Body</h4>
                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded uppercase">200 OK</span>
              </div>
              <div className="p-4 bg-slate-900 rounded-xl">
                <pre className="text-xs text-slate-300 font-mono overflow-x-auto">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Security Note */}
      <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-4">
        <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 flex-shrink-0">
          <Info className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="font-bold text-amber-900">Security & Rate Limiting</h3>
          <p className="text-sm text-amber-800/80 leading-relaxed">
            While this API is public, it is rate-limited to prevent abuse. If you require high-volume access or more sensitive data, 
            please contact the system administrator to request a private API key with full Directus access.
          </p>
        </div>
      </div>
    </div>
  );
};
