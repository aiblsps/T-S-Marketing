import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toBengaliNumber(number: number | string | undefined | null, language: 'en' | 'bn' = 'bn'): string {
  if (number === undefined || number === null) return '';
  if (language === 'en') return number.toString();
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return number.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
}

export function formatCurrency(amount: number | string, language: 'en' | 'bn' = 'bn') {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return language === 'bn' ? '০' : '0';
  
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);

  return language === 'bn' ? toBengaliNumber(formatted) : formatted;
}

export function formatNumber(number: number | string, language: 'en' | 'bn' = 'bn'): string {
  if (language === 'bn') return toBengaliNumber(number);
  return number.toString();
}

export function formatNumberWithCommas(value: string | number, language: 'en' | 'bn' = 'bn'): string {
  const num = typeof value === 'string' ? value.replace(/,/g, '') : value.toString();
  if (!num || isNaN(Number(num))) return '';
  
  const formatted = new Intl.NumberFormat('en-IN').format(Number(num));
  return language === 'bn' ? toBengaliNumber(formatted) : formatted;
}

export function parseNumberFromCommas(value: string): string {
  return value.replace(/,/g, '');
}

export function generateId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
}

export function formatDate(dateStr: string, language: 'en' | 'bn' = 'bn'): string {
  if (!dateStr || typeof dateStr !== 'string') return dateStr;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  const formattedDate = `${day}-${month}-${year}`;
  return language === 'bn' ? toBengaliNumber(formattedDate) : formattedDate;
}

export function getDirectDriveUrl(url: string) {
  if (!url) return '';
  // Handle /d/ID format
  const driveRegex = /\/d\/([a-zA-Z0-9_-]+)/;
  const match = url.match(driveRegex);
  if (match && match[1]) {
    return `https://lh3.googleusercontent.com/d/${match[1]}`;
  }
  // Handle ?id=ID format
  const idRegex = /[?&]id=([a-zA-Z0-9_-]+)/;
  const idMatch = url.match(idRegex);
  if (idMatch && idMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
  }
  return url;
}
