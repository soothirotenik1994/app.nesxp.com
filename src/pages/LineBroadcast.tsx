import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { MessageSquare, Send, Loader2, CheckCircle2, XCircle, User, Image as ImageIcon, Users, X, Plus } from 'lucide-react';
import { directusApi } from '../api/directus';
import { Member } from '../types';

export const LineBroadcast: React.FC = () => {
  const { t } = useTranslation();
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [broadcastType, setBroadcastType] = useState<'all' | 'selected'>('all');
  const [messageText, setMessageText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const data = await directusApi.getMembers();
        setMembers(data.filter(m => m.line_user_id));
      } catch (error) {
        console.error('Failed to fetch members:', error);
      }
    };
    fetchMembers();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const fileId = await directusApi.uploadFile(file);
      setImageUrl(directusApi.getFileUrl(fileId));
    } catch (err) {
      console.error('Error uploading image:', err);
    }
  };

  const handleSend = async () => {
    if (!messageText && !imageUrl) return;
    setIsSending(true);
    setStatus(null);

    try {
      const targets = broadcastType === 'all' 
        ? members.map(m => m.line_user_id!)
        : selectedMembers;

      if (targets.length === 0) {
        throw new Error('No recipients selected');
      }

      const messages = [];
      if (imageUrl) {
        messages.push({ type: 'image', originalContentUrl: imageUrl, previewImageUrl: imageUrl });
      }
      if (messageText) {
        messages.push({ type: 'text', text: messageText });
      }

      await axios.post('/api/line/broadcast', {
        to: targets,
        messages: messages
      });

      setStatus({ type: 'success', message: `Broadcast sent to ${targets.length} members successfully!` });
      setMessageText('');
      setImageUrl('');
      setSelectedMembers([]);
    } catch (error: any) {
      console.error('Broadcast failed:', error);
      setStatus({ type: 'error', message: `Failed: ${error.message}` });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">LINE Broadcast</h1>
        <p className="text-slate-500">Send messages to members</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
        <div className="space-y-4">
          <label className="text-sm font-semibold text-slate-700">Recipients</label>
          <div className="flex gap-4">
            <button onClick={() => setBroadcastType('all')} className={`px-4 py-2 rounded-xl font-bold ${broadcastType === 'all' ? 'bg-primary text-white' : 'bg-slate-100'}`}>All Members</button>
            <button onClick={() => setBroadcastType('selected')} className={`px-4 py-2 rounded-xl font-bold ${broadcastType === 'selected' ? 'bg-primary text-white' : 'bg-slate-100'}`}>Selected Members</button>
          </div>
          {broadcastType === 'selected' && (
            <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl p-2">
              {members.map(m => (
                <label key={m.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg">
                  <input type="checkbox" checked={selectedMembers.includes(m.line_user_id!)} onChange={(e) => setSelectedMembers(prev => e.target.checked ? [...prev, m.line_user_id!] : prev.filter(id => id !== m.line_user_id))} />
                  {m.first_name} {m.last_name}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Message</label>
          <textarea value={messageText} onChange={(e) => setMessageText(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" rows={4} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Image</label>
          <div className="flex items-center gap-4">
            {imageUrl && <img src={imageUrl} className="w-20 h-20 object-cover rounded-lg" />}
            <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg cursor-pointer">
              <ImageIcon className="w-5 h-5" /> Upload Image
              <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
            </label>
          </div>
        </div>

        <button onClick={handleSend} disabled={isSending} className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-blue-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          Send Broadcast
        </button>

        {status && (
          <div className={`p-4 rounded-xl flex items-center gap-2 ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {status.type === 'success' ? <CheckCircle2 /> : <XCircle />}
            {status.message}
          </div>
        )}
      </div>
    </div>
  );
};
