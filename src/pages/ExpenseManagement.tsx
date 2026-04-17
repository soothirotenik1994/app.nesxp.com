import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Coins, Plus, Trash2, Loader2, Save, CheckCircle2, Pencil, Check, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { directusApi } from '../api/directus';

export const ExpenseManagement: React.FC = () => {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings = await directusApi.getSystemSettings();
        if (settings) {
          const categories = Array.isArray(settings.expense_categories) 
            ? settings.expense_categories 
            : (typeof settings.expense_categories === 'string' ? settings.expense_categories.split(',').filter(Boolean) : []);
          setExpenseCategories(categories);
        } else {
          // Fallback to localStorage
          const localCategories = (localStorage.getItem('expense_categories') || '').split(',').filter(Boolean);
          setExpenseCategories(localCategories);
        }
      } catch (error) {
        console.error('Failed to fetch expense categories:', error);
        // Fallback to localStorage
        const localCategories = (localStorage.getItem('expense_categories') || '').split(',').filter(Boolean);
        setExpenseCategories(localCategories);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Get current settings to avoid overwriting other fields
      const currentSettings = await directusApi.getSystemSettings() || {};
      
      // Save to Directus
      await directusApi.updateSystemSettings({
        ...currentSettings,
        expense_categories: expenseCategories.join(','),
      });

      // Update localStorage for immediate use
      localStorage.setItem('expense_categories', expenseCategories.join(','));
      
      setIsSaving(false);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Failed to save expense categories:', error);
      setIsSaving(false);
      alert('Failed to save changes. Please try again.');
    }
  };

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      setExpenseCategories(prev => [...prev, newCategoryName.trim()]);
      setNewCategoryName('');
      setIsAddingCategory(false);
    }
  };

  const handleRemoveCategory = (idx: number) => {
    setExpenseCategories(prev => prev.filter((_, i) => i !== idx));
    if (editingIndex === idx) {
      setEditingIndex(null);
    }
  };

  const handleStartEdit = (idx: number, value: string) => {
    setEditingIndex(idx);
    setEditingValue(value);
  };

  const handleSaveEdit = () => {
    if (editingIndex !== null && editingValue.trim()) {
      const newCategories = [...expenseCategories];
      newCategories[editingIndex] = editingValue.trim();
      setExpenseCategories(newCategories);
      setEditingIndex(null);
      setEditingValue('');
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingValue('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('expenses')}</h1>
          <p className="text-sm text-slate-500">{t('define_expense_categories_desc', 'กำหนดรายการค่าใช้จ่ายที่คนขับสามารถเลือกได้')}</p>
        </div>
        {showSuccess && (
          <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100 animate-in fade-in slide-in-from-right-4">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-semibold">{t('save_success', 'บันทึกสำเร็จ')}</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{t('expense_categories_management', 'จัดการหมวดหมู่ค่าใช้จ่าย')}</h2>
                <p className="text-sm text-slate-500">{t('manage_predefined_expenses', 'จัดการรายการค่าใช้จ่ายมาตรฐาน')}</p>
              </div>
            </div>
            {!isAddingCategory && (
              <button
                onClick={() => setIsAddingCategory(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-all shadow-sm"
              >
                <Plus className="w-4 h-4" />
                {t('add_category', 'เพิ่มรายการ')}
              </button>
            )}
          </div>
          
          {isAddingCategory && (
            <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-primary/20 flex gap-3 animate-in slide-in-from-top-2">
              <input 
                type="text"
                autoFocus
                placeholder={t('enter_expense_category_name', 'ชื่อรายการค่าใช้จ่าย')}
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddCategory();
                  if (e.key === 'Escape') setIsAddingCategory(false);
                }}
                className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
              />
              <button
                onClick={handleAddCategory}
                className="px-4 py-2 bg-primary text-white rounded-lg font-semibold text-sm shadow-sm"
              >
                {t('add')}
              </button>
              <button
                onClick={() => {
                  setNewCategoryName('');
                  setIsAddingCategory(false);
                }}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-semibold text-sm"
              >
                {t('cancel')}
              </button>
            </div>
          )}
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {expenseCategories.map((cat, idx) => (
              <div 
                key={idx} 
                className={cn(
                  "flex items-center justify-between p-4 bg-slate-50 rounded-xl border transition-all min-h-[64px]",
                  editingIndex === idx 
                    ? "border-primary bg-white shadow-sm ring-2 ring-primary/10" 
                    : "border-slate-200 group hover:border-primary/30"
                )}
              >
                {editingIndex === idx ? (
                  <div className="flex items-center gap-2 w-full">
                    <input
                      autoFocus
                      type="text"
                      className="flex-1 bg-transparent border-none outline-none text-slate-700 font-semibold text-sm"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                    />
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleSaveEdit}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title={t('save')}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                        title={t('cancel')}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="font-semibold text-slate-700">{cat}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleStartEdit(idx, cat)}
                        className="p-1.5 text-primary hover:bg-primary/5 rounded-lg transition-colors"
                        title={t('edit')}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRemoveCategory(idx)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        title={t('delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {expenseCategories.length === 0 && (
              <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                <p className="text-slate-400">{t('no_expense_categories_desc', 'ยังไม่มีข้อมูลรายการค่าใช้จ่าย กรุณาเพิ่มรายการเพื่อให้คนขับเลือก')}</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 bg-white border-t border-slate-100 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 shadow-sm"
          >
            {isSaving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
};
