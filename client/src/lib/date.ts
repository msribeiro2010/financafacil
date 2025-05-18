import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Format a date using date-fns
 * @param date Date to format
 * @param formatStr Format string (default: dd MMM yyyy)
 * @returns Formatted date string
 */
export function formatDate(date: string | Date, formatStr = 'dd MMM yyyy'): string {
  try {
    let dateObject;
    
    if (typeof date === 'string') {
      // Ajusta o fuso horário para manter a data informada
      // Adiciona 'T12:00:00' para evitar problemas com fusos horários
      const formattedDateStr = date.includes('T') ? date : `${date}T12:00:00`;
      dateObject = parseISO(formattedDateStr);
    } else {
      dateObject = date;
    }
    
    if (!isValid(dateObject)) {
      return 'Data inválida';
    }
    
    return format(dateObject, formatStr, { locale: ptBR });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Data inválida';
  }
}

/**
 * Format a date to show relative time (today, yesterday, etc)
 * @param date Date to format
 * @returns Formatted date string with relative time
 */
export function formatRelativeDate(date: string | Date): string {
  try {
    const dateObject = typeof date === 'string' ? parseISO(date) : date;
    
    if (!isValid(dateObject)) {
      return 'Data inválida';
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const targetDate = new Date(dateObject);
    targetDate.setHours(0, 0, 0, 0);
    
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Hoje';
    } else if (diffDays === 1) {
      return 'Amanhã';
    } else if (diffDays === -1) {
      return 'Ontem';
    } else if (diffDays > 0 && diffDays <= 7) {
      return `Em ${diffDays} dias`;
    } else if (diffDays < 0 && diffDays >= -7) {
      return `Há ${Math.abs(diffDays)} dias`;
    } else {
      return format(dateObject, 'dd/MM/yyyy', { locale: ptBR });
    }
  } catch (error) {
    console.error('Error formatting relative date:', error);
    return 'Data inválida';
  }
}

/**
 * Get the first day of the month
 * @param date Date object
 * @returns Date object representing the first day of the month
 */
export function getFirstDayOfMonth(date: Date): Date {
  const result = new Date(date);
  result.setDate(1);
  return result;
}

/**
 * Get the last day of the month
 * @param date Date object
 * @returns Date object representing the last day of the month
 */
export function getLastDayOfMonth(date: Date): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + 1);
  result.setDate(0);
  return result;
}
