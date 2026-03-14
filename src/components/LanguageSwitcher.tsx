import React from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'th' : 'en';
    i18n.changeLanguage(newLang);
  };

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-600 font-medium text-sm"
      title="Switch Language"
    >
      <Languages className="w-4 h-4" />
      <span>{i18n.language === 'en' ? 'TH' : 'EN'}</span>
    </button>
  );
};
