import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface SystemAlert {
  id: string;
  message: string;
  timestamp: string;
  isRead: boolean;
}

interface SystemAlertContextType {
  alerts: SystemAlert[];
  addAlert: (message: string) => void;
  markAsRead: (id: string) => void;
  clearAll: () => void;
  unreadCount: number;
}

const SystemAlertContext = createContext<SystemAlertContextType | undefined>(undefined);

export const SystemAlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alerts, setAlerts] = useState<SystemAlert[]>(() => {
    const saved = localStorage.getItem('system_alerts');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('system_alerts', JSON.stringify(alerts));
  }, [alerts]);

  const addAlert = useCallback((message: string) => {
    const newAlert: SystemAlert = {
      id: Date.now().toString(),
      message,
      timestamp: new Date().toISOString(),
      isRead: false,
    };
    setAlerts(prev => [newAlert, ...prev]);
  }, []);

  const markAsRead = useCallback((id: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === id ? { ...alert, isRead: true } : alert
    ));
  }, []);

  const clearAll = useCallback(() => {
    setAlerts([]);
  }, []);

  const unreadCount = alerts.filter(a => !a.isRead).length;

  // Listen for global system-alert events
  useEffect(() => {
    const handleGlobalAlert = (event: any) => {
      if (event.detail?.message) {
        addAlert(event.detail.message);
      }
    };

    window.addEventListener('system-alert', handleGlobalAlert);
    return () => window.removeEventListener('system-alert', handleGlobalAlert);
  }, [addAlert]);

  return (
    <SystemAlertContext.Provider value={{ alerts, addAlert, markAsRead, clearAll, unreadCount }}>
      {children}
    </SystemAlertContext.Provider>
  );
};

export const useSystemAlerts = () => {
  const context = useContext(SystemAlertContext);
  if (context === undefined) {
    throw new Error('useSystemAlerts must be used within a SystemAlertProvider');
  }
  return context;
};
