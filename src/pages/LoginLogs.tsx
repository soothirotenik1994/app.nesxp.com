import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { History, AlertCircle } from 'lucide-react';
import { directusApi } from '../api/directus';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

export const LoginLogs: React.FC = () => {
  const { t } = useTranslation();
  const [loginLogs, setLoginLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoadingLogs(true);
      try {
        const logs = await directusApi.getLoginLogs();
        setLoginLogs(logs);
      } catch (error) {
        console.error('Failed to fetch login logs:', error);
      } finally {
        setIsLoadingLogs(false);
      }
    };
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('login_history')}</h1>
        </div>
      </div>

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

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">{t('user')}</th>
                <th className="px-6 py-4">{t('ip_address')}</th>
                <th className="px-6 py-4">{t('login_time')}</th>
                <th className="px-6 py-4">{t('status')}</th>
                <th className="px-6 py-4">{t('user_agent')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingLogs ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-full"></div>
                    </td>
                  </tr>
                ))
              ) : loginLogs.length > 0 ? (
                loginLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{log.user_email}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                      {log.ip_address}
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-sm">
                      {log.timestamp ? format(new Date(log.timestamp), 'dd MMM yyyy HH:mm:ss', { locale: th }) : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                        log.status === 'success' 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {log.status === 'success' ? t('success') : t('failed')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs max-w-xs truncate" title={log.user_agent}>
                      {log.user_agent}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-32 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="w-8 h-8 text-slate-200" />
                      <p className="text-slate-400 font-medium">{t('no_history_found')}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
