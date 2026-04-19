import { format } from 'date-fns';
import { th, enUS } from 'date-fns/locale';
import i18n from '../i18n';

export const formatDate = (date: Date | number | string, formatStr: string = 'dd/MM/yyyy') => {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  const locale = i18n.language === 'th' ? th : enUS;
  return format(d, formatStr, { locale });
};

export const formatTime = (date: Date | number | string) => {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'HH:mm'); // 24-hour format
};

export const formatDateTime = (date: Date | number | string) => {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'dd/MM/yyyy HH:mm');
};
