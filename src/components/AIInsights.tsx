import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { aiService } from '../services/aiService';
import { useTranslation } from 'react-i18next';

interface AIInsightsProps {
  data: any;
}

export const AIInsights: React.FC<AIInsightsProps> = ({ data }) => {
  const [insights, setInsights] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  const fetchInsights = async () => {
    if (!data || data.length === 0) return;
    setLoading(true);
    try {
      const result = await aiService.generateInsights(data);
      setInsights(result);
    } catch (error) {
      setInsights('Failed to load insights.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
        <Sparkles className="w-24 h-24 text-primary" />
      </div>
      
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800">AI Fleet Insights</h3>
        </div>
        <button 
          onClick={fetchInsights}
          disabled={loading}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors disabled:opacity-50"
          title="Refresh Insights"
        >
          <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="relative z-10">
        {loading ? (
          <div className="space-y-3">
            <div className="h-4 bg-slate-100 rounded w-3/4 animate-pulse"></div>
            <div className="h-4 bg-slate-100 rounded w-5/6 animate-pulse"></div>
            <div className="h-4 bg-slate-100 rounded w-2/3 animate-pulse"></div>
          </div>
        ) : (
          <div className="prose prose-slate prose-sm max-w-none">
            <div className="text-slate-600 whitespace-pre-line">
              {insights || "No data available for analysis."}
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
        <span>Powered by Gemini 3.1 Flash</span>
      </div>
    </div>
  );
};
