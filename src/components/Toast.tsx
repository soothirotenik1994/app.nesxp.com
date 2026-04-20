import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Info, AlertTriangle, CheckCircle, X } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  useEffect(() => {
    const handleToastEvent = (event: any) => {
      if (event.detail?.message) {
        addToast(event.detail.message, event.detail.type || 'info');
      }
    };

    window.addEventListener('show-toast', handleToastEvent);
    return () => window.removeEventListener('show-toast', handleToastEvent);
  }, [addToast]);

  return (
    <div className="fixed top-20 right-6 z-[10001] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            className={`
              pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border min-w-[300px] max-w-md
              ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-900' : 
                toast.type === 'error' ? 'bg-red-50 border-red-100 text-red-900' :
                toast.type === 'warning' ? 'bg-amber-50 border-amber-100 text-amber-900' :
                'bg-white border-slate-100 text-slate-900'}
            `}
          >
            <div className={`p-2 rounded-xl ${
              toast.type === 'success' ? 'bg-emerald-500/10' : 
              toast.type === 'error' ? 'bg-red-500/10' :
              toast.type === 'warning' ? 'bg-amber-500/10' :
              'bg-blue-500/10'
            }`}>
              {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-600" />}
              {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-red-600" />}
              {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-600" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-blue-600" />}
            </div>
            
            <p className="flex-1 text-sm font-bold tracking-tight">
              {toast.message}
            </p>

            <button 
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="p-1 hover:bg-black/5 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 opacity-50" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

// Helper function to show toast
export const showToast = (message: string, type: Toast['type'] = 'info') => {
  window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type } }));
};
