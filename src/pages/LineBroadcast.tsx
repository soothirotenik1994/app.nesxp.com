import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { MessageSquare, Send, Loader2, CheckCircle2, XCircle, User, Image as ImageIcon, Users, X, Plus } from 'lucide-react';
import { directusApi } from '../api/directus';
import { Member } from '../types';
import { lineService } from '../services/lineService';

export const LineBroadcast: React.FC = () => {
  const { t } = useTranslation();
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [broadcastType, setBroadcastType] = useState<'all' | 'selected'>('all');
  const [messageText, setMessageText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageId, setImageId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');

  const getLineId = (m: Member): string | null => {
    const raw = m.line_user_id;
    if (!raw) return null;
    return typeof raw === 'object' && raw !== null ? (raw as any).line_user_id || (raw as any).id : raw;
  };

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const data = await directusApi.getMembers();
        setMembers(data.filter(m => getLineId(m)));
      } catch (error: any) {
        if (error.response?.status === 401) {
          return;
        }
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
      setImageId(fileId);
      setImageUrl(directusApi.getFileUrl(fileId));
    } catch (err) {
      console.error('Error uploading image:', err);
    }
  };

  const handleSave = async () => {
    if (!messageText && !imageUrl) return;
    setIsSending(true);
    setStatus(null);

    try {
      const targets = broadcastType === 'all' 
        ? members.map(m => getLineId(m)!).filter(Boolean)
        : selectedMembers;

      if (targets.length === 0) {
        throw new Error('No recipients selected');
      }

      if (isScheduled && !scheduledAt) {
        throw new Error('Please select a schedule time');
      }

      const broadcastData = {
        message: messageText || null,
        image: imageId || null,
        recipients: targets,
        scheduled_at: isScheduled ? new Date(scheduledAt).toISOString() : new Date().toISOString(),
        status: isScheduled ? 'scheduled' : 'sent'
      };

      console.log('Sending broadcastData to Directus:', broadcastData);

      // If not scheduled, send immediately (or let the backend handle it)
      if (!isScheduled) {
        const messages = [];
        if (imageUrl) {
          messages.push({ type: 'image', originalContentUrl: imageUrl, previewImageUrl: imageUrl });
        }
        if (messageText) {
          messages.push({ type: 'text', text: messageText });
        }

        if (messages.length === 0) {
          console.error('No messages to send');
          return;
        }

        console.log('Sending broadcast request:', { to: targets, messages });

        await lineService.broadcastMessage(targets, messages);
      }

      // Save to Directus
      await directusApi.createItem('line_broadcasts', broadcastData);

      setStatus({ type: 'success', message: `Broadcast ${isScheduled ? 'scheduled' : 'sent'} successfully!` });
      setMessageText('');
      setImageUrl('');
      setImageId(null);
      setSelectedMembers([]);
      setScheduledAt('');
      setIsScheduled(false);
    } catch (error: any) {
      console.error('Broadcast failed:', error);
      let errorMessage = error.message;
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        errorMessage = error.response.data.errors.map((e: any) => e.message).join(', ');
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.details) {
        errorMessage = typeof error.response.data.details === 'string' ? error.response.data.details : JSON.stringify(error.response.data.details);
      }
      setStatus({ type: 'error', message: `Failed: ${errorMessage}` });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">LINE Broadcast</h1>
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
              {members.map(m => {
                const lineId = getLineId(m);
                if (!lineId) return null;
                return (
                  <label key={m.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg">
                    <input type="checkbox" checked={selectedMembers.includes(lineId)} onChange={(e) => setSelectedMembers(prev => e.target.checked ? [...prev, lineId] : prev.filter(id => id !== lineId))} />
                    {m.first_name} {m.last_name}
                  </label>
                );
              })}
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

        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isScheduled} onChange={(e) => setIsScheduled(e.target.checked)} />
            <span className="text-sm font-semibold text-slate-700">Schedule Message</span>
          </label>
          {isScheduled && (
            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" />
          )}
        </div>

        <button onClick={handleSave} disabled={isSending} className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-blue-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          {isScheduled ? 'Schedule Broadcast' : 'Send Broadcast'}
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
