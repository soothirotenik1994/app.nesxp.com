import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { directusApi } from '../api/directus';
import { Star, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { WorkReport } from '../types';

export const CustomerRating: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [report, setReport] = useState<WorkReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    const fetchReport = async () => {
      if (!id) return;
      try {
        const data = await directusApi.getWorkReport(id);
        setReport(data);
        if (data.rating) {
          setRating(data.rating);
          setFeedback(data.feedback || '');
          setSuccess(true); // Already rated
        }
      } catch (err) {
        console.error('Error fetching report:', err);
        setError(t('error_loading_data', 'เกิดข้อผิดพลาดในการโหลดข้อมูล'));
      } finally {
        setLoading(false);
      }
    };
    
    fetchReport();
  }, [id, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || rating === 0) return;
    
    setSubmitting(true);
    setError(null);
    
    try {
      await directusApi.updateWorkReport(id, {
        rating,
        feedback,
        rated_at: new Date().toISOString()
      });
      setSuccess(true);
    } catch (err) {
      console.error('Error submitting rating:', err);
      setError(t('error_saving', 'เกิดข้อผิดพลาดในการบันทึกข้อมูล'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-slate-500 font-medium">{t('loading', 'กำลังโหลด...')}</p>
        </div>
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-red-100 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">{t('error', 'เกิดข้อผิดพลาด')}</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
          >
            {t('try_again', 'ลองใหม่อีกครั้ง')}
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-emerald-100 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">{t('thank_you_rating')}</h2>
          <p className="text-slate-600 mb-8">{t('rating_improve_desc')}</p>
          
          <div className="flex justify-center gap-2 mb-8">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star 
                key={star} 
                className={`w-8 h-8 ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} 
              />
            ))}
          </div>
          
          <button 
            onClick={() => navigate('/')}
            className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
          >
            {t('back_to_home')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 max-w-md w-full overflow-hidden">
        <div className="bg-primary p-6 text-white text-center">
          <h1 className="text-xl font-bold mb-1">{t('rate_service_label')}</h1>
          <p className="text-blue-100 text-sm opacity-90">{t('case_id_label', { id: report?.case_number || '-' })}</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-8 text-center">
            <p className="text-slate-600 font-medium mb-4">{t('satisfaction_question')}</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="focus:outline-none transition-transform hover:scale-110"
                >
                  <Star 
                    className={`w-10 h-10 transition-colors ${
                      star <= (hoverRating || rating) 
                        ? 'fill-amber-400 text-amber-400' 
                        : 'text-slate-200 hover:text-amber-200'
                    }`} 
                  />
                </button>
              ))}
            </div>
          </div>
          
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              {t('additional_feedback_optional')}
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder={t('feedback_placeholder')}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none h-32 transition-all"
            />
          </div>
          
          {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={rating === 0 || submitting}
            className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
              rating === 0 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                : 'bg-primary text-white hover:bg-blue-700 shadow-lg shadow-blue-100'
            }`}
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {t('saving')}...
              </>
            ) : (
              t('submit_rating')
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
