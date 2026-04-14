import React, { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';

export const NotificationMailbox: React.FC = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newNotifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNotifications(newNotifications);
    });

    return () => unsubscribe();
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string) => {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-slate-100 rounded-lg relative"
      >
        <Bell className="w-6 h-6 text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-[2000]">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-900">Notifications</h3>
            <button onClick={() => setIsOpen(false)}><X className="w-4 h-4 text-slate-400" /></button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-4 text-sm text-slate-500 text-center">No notifications</p>
            ) : (
              notifications.map(n => (
                <div 
                  key={n.id} 
                  className={`p-4 border-b border-slate-50 cursor-pointer hover:bg-white ${!n.read ? 'bg-blue-50' : ''}`}
                  onClick={() => markAsRead(n.id)}
                >
                  <p className={`text-sm ${n.type === 'error' ? 'text-red-600 font-bold' : 'text-slate-700'}`}>
                    {n.message}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
