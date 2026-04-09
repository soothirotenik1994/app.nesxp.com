import { format } from 'date-fns';
import { th, enUS } from 'date-fns/locale';
import i18n from '../i18n';

export const formatDate = (date: Date | number, formatStr: string) => {
  const locale = i18n.language === 'th' ? th : enUS;
  return format(date, formatStr, { locale });
};
