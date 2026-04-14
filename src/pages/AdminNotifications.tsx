import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { directusApi } from '../api/directus';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

export const AdminNotifications: React.FC = () => {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      setLoading(true);
      try {
        // Fetch all notifications, sorted by created_at descending
        const response = await directusApi.getItems('admin_notifications', {
          sort: '-created_at',
          limit: 100
        });
        setNotifications(response);
      } catch (error: any) {
        if (error.response?.status === 401) {
          return;
        }
        console.error('Error fetching all notifications:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id: string) => {
    await directusApi.updateItem('admin_notifications', id, { is_read: true });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('admin_notifications')}</h1>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-slate-500">{t('loading')}</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            {t('no_notifications')}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map(n => (
              <div key={n.id} className={`p-4 flex items-start justify-between gap-4 ${n.is_read ? 'bg-white' : 'bg-white'}`}>
                <div className="flex items-start gap-3">
                  {n.type === 'error' ? <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" /> : <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5" />}
                  <div>
                    <p className={`text-sm ${n.is_read ? 'text-slate-600' : 'text-slate-900 font-medium'}`}>{n.message}</p>
                    <p className="text-xs text-slate-400 mt-1">{format(new Date(n.created_at), 'yyyy-MM-dd HH:mm:ss')}</p>
                  </div>
                </div>
                {!n.is_read && (
                  <button 
                    onClick={() => handleMarkAsRead(n.id)}
                    className="text-xs text-primary font-bold hover:underline"
                  >
                    {t('mark_as_read')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
